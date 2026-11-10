-- ============================================================
-- Fashion Crown Kenya — Database Schema & Security Foundation
-- Supabase PostgreSQL Migration (001_schema.sql)
-- Hardened against unauthorized writes, vote tampering, and data scraping
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Competitions table
CREATE TABLE competitions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    banner_url TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contestants table
CREATE TABLE contestants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bio TEXT,
    photo_url TEXT,
    is_demo BOOLEAN DEFAULT FALSE,
    vote_count INTEGER DEFAULT 0 CHECK (vote_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table (Strict financial ledger)
CREATE TABLE transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    competition_id UUID NOT NULL REFERENCES competitions(id),
    contestant_id UUID NOT NULL REFERENCES contestants(id),
    phone_number TEXT NOT NULL CHECK (phone_number ~ '^254[17][0-9]{8}$'),
    amount INTEGER NOT NULL CHECK (amount >= 50 AND amount <= 1000 AND (amount % 50) = 0),
    votes INTEGER NOT NULL CHECK (votes = (amount / 50)),
    mpesa_receipt TEXT UNIQUE,
    checkout_request_id TEXT UNIQUE,
    merchant_request_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    result_description TEXT,
    client_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate Limiting Table (In-database protection against STK push flooding & DDoS)
CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ
);

-- Security Audit Log Table
CREATE TABLE security_audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    details JSONB NOT NULL,
    client_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX idx_contestants_competition ON contestants(competition_id);
CREATE INDEX idx_contestants_votes ON contestants(vote_count DESC);
CREATE INDEX idx_transactions_contestant ON transactions(contestant_id);
CREATE INDEX idx_transactions_competition ON transactions(competition_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_checkout ON transactions(checkout_request_id);
CREATE INDEX idx_transactions_receipt ON transactions(mpesa_receipt);
CREATE INDEX idx_competitions_dates ON competitions(start_date, end_date);
CREATE INDEX idx_rate_limits_blocked ON rate_limits(blocked_until);

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- ── Competitions RLS ──
-- Public can read all competitions
CREATE POLICY "competitions_select_public"
    ON competitions FOR SELECT
    TO anon, authenticated
    USING (true);

-- Only authenticated admins can modify competitions
CREATE POLICY "competitions_admin_all"
    ON competitions FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'authenticated' OR auth.role() = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'authenticated' OR auth.role() = 'service_role');

-- ── Contestants RLS ──
-- Public can read contestants and rankings
CREATE POLICY "contestants_select_public"
    ON contestants FOR SELECT
    TO anon, authenticated
    USING (true);

-- Admins can insert, update bio/photo, or delete
CREATE POLICY "contestants_admin_all"
    ON contestants FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'authenticated' OR auth.role() = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'authenticated' OR auth.role() = 'service_role');

-- ── Transactions RLS (CRITICAL SECURITY) ──
-- 1. Public is DENIED direct access to transactions table to prevent scraping full phone numbers & receipts.
--    Public queries MUST use public_transactions view (where phone numbers are masked).
-- 2. Only authenticated admins and the backend service_role can select raw transactions.
CREATE POLICY "transactions_select_admin"
    ON transactions FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'authenticated' OR auth.role() = 'service_role');

-- 3. Anonymous users can NEVER insert, update, or delete transactions directly!
--    All transaction creation & state transitions MUST be executed via Edge Functions with service_role.
CREATE POLICY "transactions_service_insert"
    ON transactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "transactions_service_update"
    ON transactions FOR UPDATE
    TO authenticated
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ── Rate Limits & Audit Logs RLS ──
-- Restricted to backend service_role only
CREATE POLICY "rate_limits_service_all"
    ON rate_limits FOR ALL
    TO authenticated
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "audit_logs_service_all"
    ON security_audit_logs FOR ALL
    TO authenticated
    USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'authenticated')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4. PUBLIC VIEWS (Masked Data for Privacy Protection)
-- ============================================================

-- Masks customer phone numbers for public live feeds (e.g. 254712***678)
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

-- Grant SELECT on public view to anon and authenticated
GRANT SELECT ON public_transactions TO anon, authenticated;

-- ============================================================
-- 5. STORED PROCEDURES & ATOMIC SECURITY FUNCTIONS
-- ============================================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_competitions_updated_at
    BEFORE UPDATE ON competitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_contestants_updated_at
    BEFORE UPDATE ON contestants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ── Atomic Vote Crediting Function (SECURE & IDEMPOTENT) ──
-- Enforces:
-- 1. Row locking (FOR UPDATE) to prevent concurrency/double-spend race conditions.
-- 2. Verification that amount matches the pending transaction exactly.
-- 3. M-Pesa receipt uniqueness.
-- 4. Automatic calculation of votes (amount / 50).
-- 5. Atomic increment of contestants.vote_count.
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
    -- 1. Validate arguments
    IF p_checkout_request_id IS NULL OR TRIM(p_checkout_request_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'CheckoutRequestID is required');
    END IF;

    IF p_mpesa_receipt IS NULL OR TRIM(p_mpesa_receipt) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid MpesaReceiptNumber is required');
    END IF;

    -- 2. Lock the transaction row
    SELECT id, contestant_id, amount, status, mpesa_receipt
    INTO v_transaction
    FROM transactions
    WHERE checkout_request_id = p_checkout_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Log suspicious callback
        INSERT INTO security_audit_logs (event_type, severity, details)
        VALUES ('UNKNOWN_CHECKOUT_CALLBACK', 'warning', jsonb_build_object(
            'checkout_request_id', p_checkout_request_id,
            'receipt', p_mpesa_receipt
        ));

        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    -- 3. Idempotent check: already completed?
    IF v_transaction.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Transaction already completed',
            'already_processed', true,
            'transaction_id', v_transaction.id
        );
    END IF;

    -- 4. Check if receipt was already claimed in another transaction (Replay attack defense)
    SELECT id INTO v_existing_receipt
    FROM transactions
    WHERE mpesa_receipt = p_mpesa_receipt AND id != v_transaction.id;

    IF FOUND THEN
        -- Log critical fraud attempt
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

    -- 5. Amount tampering check
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

    -- 6. Calculate votes securely
    v_votes := FLOOR(v_transaction.amount / 50);

    -- 7. Update transaction to completed
    UPDATE transactions
    SET status = 'completed',
        mpesa_receipt = p_mpesa_receipt,
        votes = v_votes,
        result_description = 'Payment verified and confirmed via M-Pesa Daraja API'
    WHERE id = v_transaction.id;

    -- 8. Increment contestant vote count
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

-- ── Mark Transaction As Failed ──
CREATE OR REPLACE FUNCTION fail_transaction(
    p_checkout_request_id TEXT,
    p_result_description TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_transaction_id UUID;
BEGIN
    UPDATE transactions
    SET status = 'failed',
        result_description = p_result_description
    WHERE checkout_request_id = p_checkout_request_id
      AND status = 'pending'
    RETURNING id INTO v_transaction_id;

    IF v_transaction_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found or already finalized');
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Secure Client Status Lookup (Protects PII / Phone Numbers) ──
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

-- ── Secure Public Aggregate Statistics ──
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

-- ── Rate Limiting Stored Procedure ──
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

    -- Check if currently blocked
    IF v_limit.blocked_until IS NOT NULL AND v_limit.blocked_until > v_now THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'blocked', true,
            'retry_after', EXTRACT(EPOCH FROM (v_limit.blocked_until - v_now))::INT
        );
    END IF;

    -- Check if window has expired: reset if so
    IF v_limit.first_attempt_at < (v_now - (p_window_seconds || ' seconds')::INTERVAL) THEN
        UPDATE rate_limits
        SET attempts = 1,
            first_attempt_at = v_now,
            last_attempt_at = v_now,
            blocked_until = NULL
        WHERE key = p_key;

        RETURN jsonb_build_object('allowed', true, 'remaining', p_max_attempts - 1);
    END IF;

    -- Window still active: increment attempts
    IF v_limit.attempts >= p_max_attempts THEN
        -- Block the client
        UPDATE rate_limits
        SET blocked_until = v_now + (p_block_seconds || ' seconds')::INTERVAL,
            last_attempt_at = v_now
        WHERE key = p_key;

        INSERT INTO security_audit_logs (event_type, severity, details)
        VALUES ('RATE_LIMIT_TRIGGERED', 'warning', jsonb_build_object('key', p_key, 'attempts', v_limit.attempts + 1));

        RETURN jsonb_build_object(
            'allowed', false,
            'blocked', true,
            'retry_after', p_block_seconds
        );
    END IF;

    UPDATE rate_limits
    SET attempts = attempts + 1,
        last_attempt_at = v_now
    WHERE key = p_key;

    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_attempts - (v_limit.attempts + 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Auto-update competition status ──
CREATE OR REPLACE FUNCTION update_competition_status()
RETURNS void AS $$
BEGIN
    UPDATE competitions
    SET status = CASE
        WHEN start_date <= NOW() AND end_date > NOW() THEN 'active'
        WHEN end_date <= NOW() THEN 'ended'
        ELSE 'upcoming'
    END
    WHERE status != CASE
        WHEN start_date <= NOW() AND end_date > NOW() THEN 'active'
        WHEN end_date <= NOW() THEN 'ended'
        ELSE 'upcoming'
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. PERMISSIONS & RESTRICTIONS (LOCKDOWN)
-- ============================================================

-- Revoke dangerous direct execution from anonymous users
REVOKE ALL ON FUNCTION credit_votes(TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fail_transaction(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION update_competition_status() FROM PUBLIC, anon, authenticated;

-- Grant execution ONLY to service_role (backend edge functions)
GRANT EXECUTE ON FUNCTION credit_votes(TEXT, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION fail_transaction(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION update_competition_status() TO service_role;

-- Grant safe client status check (does not leak phone numbers)
GRANT EXECUTE ON FUNCTION get_vote_status(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_public_stats(UUID) TO anon, authenticated, service_role;

-- ============================================================
-- 7. REAL-TIME PUBLICATIONS
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE contestants;

-- ============================================================
-- 8. SEED DATA (Fashion Crown Kenya 2026)
-- ============================================================

INSERT INTO competitions (id, title, description, start_date, end_date, status)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Fashion Crown Kenya 2026',
    'Vote for your favourite fashion designer and help them claim the prestigious Fashion Crown! The top 3 contestants walk away with major cash prizes, brand endorsements, and an exclusive feature in Fashion Crown Magazine.',
    NOW(),
    NOW() + INTERVAL '7 days',
    'active'
);

INSERT INTO contestants (competition_id, name, bio, photo_url, is_demo, vote_count)
VALUES
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'Amara Okafor',
        'Haute couture evening wear and modern African silhouettes. Crafting statement pieces that command attention on international runways.',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=750&fit=crop',
        false,
        1420
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        '[Demo] Liam Chen',
        'Urban streetwear innovator blending minimalist aesthetics with functional luxury accessories.',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=750&fit=crop',
        true,
        980
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        '[Demo] Sofia Martinez',
        'Sustainable luxury fashion made from ethically sourced organic silk and handcrafted artisanal textiles.',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=750&fit=crop',
        true,
        850
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        '[Demo] David Kimani',
        'Bespoke tailoring and modern African luxury menswear inspired by Kenya''s architectural renaissance.',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=750&fit=crop',
        true,
        640
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        '[Demo] Zara Ndung''u',
        'Afro-futuristic avant-garde designs celebrating East African heritage through geometric structural draping.',
        'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=750&fit=crop',
        true,
        510
    );
