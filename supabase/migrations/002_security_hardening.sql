-- ============================================================
-- Fashion Crown Kenya — Incremental Security Hardening Migration
-- Supabase PostgreSQL Migration (002_security_hardening.sql)
-- Apply this to an existing database to enforce all security updates
-- ============================================================

-- 1. Ensure columns & constraints exist
ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS client_ip TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enforce strict constraints on transactions
ALTER TABLE transactions 
    DROP CONSTRAINT IF EXISTS transactions_phone_number_check,
    ADD CONSTRAINT transactions_phone_number_check CHECK (phone_number ~ '^254[17][0-9]{8}$');

ALTER TABLE transactions 
    DROP CONSTRAINT IF EXISTS transactions_amount_check,
    ADD CONSTRAINT transactions_amount_check CHECK (amount >= 50 AND amount <= 1000 AND (amount % 50) = 0);

ALTER TABLE transactions 
    DROP CONSTRAINT IF EXISTS transactions_votes_check,
    ADD CONSTRAINT transactions_votes_check CHECK (votes = (amount / 50));

-- Unique constraint on M-Pesa receipt to eliminate replay attacks
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_mpesa_receipt_key'
    ) THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_mpesa_receipt_key UNIQUE (mpesa_receipt);
    END IF;
END $$;

-- 2. Create rate_limits table if not exists
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ
);

-- 3. Create security audit logs table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    details JSONB NOT NULL,
    client_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on rate_limits and audit logs
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Lockdown RLS Policies
-- Drop insecure public insert policy on transactions
DROP POLICY IF EXISTS "transactions_insert_public" ON transactions;
DROP POLICY IF EXISTS "transactions_select_public" ON transactions;
DROP POLICY IF EXISTS "transactions_select_admin" ON transactions;
DROP POLICY IF EXISTS "transactions_service_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_service_update" ON transactions;

-- Only authenticated admin and service_role can select raw transactions
CREATE POLICY "transactions_select_admin"
    ON transactions FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'authenticated' OR auth.role() = 'service_role');

-- Only service_role can insert or update transactions
CREATE POLICY "transactions_service_insert"
    ON transactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "transactions_service_update"
    ON transactions FOR UPDATE
    TO authenticated
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Rate limits & Audit logs policies
DROP POLICY IF EXISTS "rate_limits_service_all" ON rate_limits;
CREATE POLICY "rate_limits_service_all"
    ON rate_limits FOR ALL
    TO authenticated
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "audit_logs_service_all" ON security_audit_logs;
CREATE POLICY "audit_logs_service_all"
    ON security_audit_logs FOR ALL
    TO authenticated
    USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'authenticated')
    WITH CHECK (auth.role() = 'service_role');

-- 5. Public Masked View
CREATE OR REPLACE VIEW public_transactions AS
SELECT
    t.id,
    t.competition_id,
    t.contestant_id,
    c.name AS contestant_name,
    CONCAT(LEFT(t.phone_number, 6), '***', RIGHT(t.phone_number, 3)) AS phone_masked,
    t.amount,
    t.votes,
    t.status,
    t.created_at
FROM transactions t
JOIN contestants c ON t.contestant_id = c.id
WHERE t.status = 'completed';

GRANT SELECT ON public_transactions TO anon, authenticated;

-- 6. Replace and Harden Stored Procedures
CREATE OR REPLACE FUNCTION credit_votes(
    p_checkout_request_id TEXT,
    p_mpesa_receipt TEXT,
    p_amount_paid NUMERIC DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_transaction RECORD;
    v_votes INTEGER;
    v_existing_receipt RECORD;
BEGIN
    IF p_checkout_request_id IS NULL OR TRIM(p_checkout_request_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'CheckoutRequestID is required');
    END IF;

    IF p_mpesa_receipt IS NULL OR TRIM(p_mpesa_receipt) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid MpesaReceiptNumber is required');
    END IF;

    SELECT id, contestant_id, amount, status, mpesa_receipt
    INTO v_transaction
    FROM transactions
    WHERE checkout_request_id = p_checkout_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO security_audit_logs (event_type, severity, details)
        VALUES ('UNKNOWN_CHECKOUT_CALLBACK', 'warning', jsonb_build_object(
            'checkout_request_id', p_checkout_request_id,
            'receipt', p_mpesa_receipt
        ));
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF v_transaction.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Transaction already completed',
            'already_processed', true,
            'transaction_id', v_transaction.id
        );
    END IF;

    SELECT id INTO v_existing_receipt
    FROM transactions
    WHERE mpesa_receipt = p_mpesa_receipt AND id != v_transaction.id;

    IF FOUND THEN
        INSERT INTO security_audit_logs (event_type, severity, details)
        VALUES ('REPLAY_RECEIPT_ATTACK', 'critical', jsonb_build_object(
            'checkout_request_id', p_checkout_request_id,
            'receipt', p_mpesa_receipt,
            'target_transaction', v_transaction.id,
            'existing_transaction', v_existing_receipt.id
        ));

        UPDATE transactions
        SET status = 'failed',
            result_description = 'Fraud Alert: Duplicate M-Pesa receipt used'
        WHERE id = v_transaction.id;

        RETURN jsonb_build_object('success', false, 'error', 'Duplicate M-Pesa receipt');
    END IF;

    IF p_amount_paid IS NOT NULL AND p_amount_paid != v_transaction.amount THEN
        INSERT INTO security_audit_logs (event_type, severity, details)
        VALUES ('TAMPERED_PAYMENT_AMOUNT', 'critical', jsonb_build_object(
            'checkout_request_id', p_checkout_request_id,
            'expected_amount', v_transaction.amount,
            'actual_amount_paid', p_amount_paid
        ));

        UPDATE transactions
        SET status = 'failed',
            result_description = 'Payment failed: Amount paid does not match registered transaction amount'
        WHERE id = v_transaction.id;

        RETURN jsonb_build_object('success', false, 'error', 'Amount mismatch');
    END IF;

    v_votes := FLOOR(v_transaction.amount / 50);

    UPDATE transactions
    SET status = 'completed',
        mpesa_receipt = p_mpesa_receipt,
        votes = v_votes,
        result_description = 'Payment verified and confirmed via M-Pesa Daraja API'
    WHERE id = v_transaction.id;

    UPDATE contestants
    SET vote_count = vote_count + v_votes
    WHERE id = v_transaction.contestant_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Votes credited successfully',
        'votes_added', v_votes,
        'transaction_id', v_transaction.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rate limiter function
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_max_attempts INT,
    p_window_seconds INT,
    p_block_seconds INT
)
RETURNS JSONB AS $$
DECLARE
    v_limit RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_limit FROM rate_limits WHERE key = p_key FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO rate_limits (key, attempts, first_attempt_at, last_attempt_at)
        VALUES (p_key, 1, v_now, v_now);
        RETURN jsonb_build_object('allowed', true, 'remaining', p_max_attempts - 1);
    END IF;

    IF v_limit.blocked_until IS NOT NULL AND v_limit.blocked_until > v_now THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'blocked', true,
            'retry_after', EXTRACT(EPOCH FROM (v_limit.blocked_until - v_now))::INT
        );
    END IF;

    IF v_limit.first_attempt_at < (v_now - (p_window_seconds || ' seconds')::INTERVAL) THEN
        UPDATE rate_limits
        SET attempts = 1,
            first_attempt_at = v_now,
            last_attempt_at = v_now,
            blocked_until = NULL
        WHERE key = p_key;
        RETURN jsonb_build_object('allowed', true, 'remaining', p_max_attempts - 1);
    END IF;

    IF v_limit.attempts >= p_max_attempts THEN
        UPDATE rate_limits
        SET blocked_until = v_now + (p_block_seconds || ' seconds')::INTERVAL,
            last_attempt_at = v_now
        WHERE key = p_key;

        INSERT INTO security_audit_logs (event_type, severity, details)
        VALUES ('RATE_LIMIT_TRIGGERED', 'warning', jsonb_build_object('key', p_key, 'attempts', v_limit.attempts + 1));

        RETURN jsonb_build_object('allowed', false, 'blocked', true, 'retry_after', p_block_seconds);
    END IF;

    UPDATE rate_limits
    SET attempts = attempts + 1,
        last_attempt_at = v_now
    WHERE key = p_key;

    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_attempts - (v_limit.attempts + 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe Client Status Check
CREATE OR REPLACE FUNCTION get_vote_status(p_checkout_request_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_record RECORD;
BEGIN
    SELECT id, status, votes, amount, result_description, created_at
    INTO v_record
    FROM transactions
    WHERE checkout_request_id = p_checkout_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', v_record.status,
        'votes', v_record.votes,
        'amount', v_record.amount,
        'result_description', v_record.result_description,
        'created_at', v_record.created_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe Public Aggregate Statistics
CREATE OR REPLACE FUNCTION get_public_stats(p_competition_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_total_votes INT := 0;
    v_total_raised INT := 0;
    v_contestant_count INT := 0;
    v_completed_count INT := 0;
BEGIN
    SELECT COALESCE(SUM(vote_count), 0), COUNT(id)
    INTO v_total_votes, v_contestant_count
    FROM contestants
    WHERE (p_competition_id IS NULL OR competition_id = p_competition_id);

    SELECT COALESCE(SUM(amount), 0), COUNT(id)
    INTO v_total_raised, v_completed_count
    FROM transactions
    WHERE status = 'completed'
      AND (p_competition_id IS NULL OR competition_id = p_competition_id);

    RETURN jsonb_build_object(
        'total_votes', v_total_votes,
        'total_raised', v_total_raised,
        'contestant_count', v_contestant_count,
        'completed_transactions', v_completed_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke direct permissions
REVOKE ALL ON FUNCTION credit_votes(TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INT, INT, INT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION credit_votes(TEXT, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION get_vote_status(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_public_stats(UUID) TO anon, authenticated, service_role;
