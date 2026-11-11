/* =========================================================
   Malonte — Voting Page Logic  (vote.js)
   Powers the entire voting flow on vote.html
   ========================================================= */

(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────────
    var selectedContestant = null;
    var selectedAmount = 0;
    var selectedVotes = 0;
    var phoneNumber = '';
    var isProcessing = false;
    var contestants = [];

    // ── DOM Refs ───────────────────────────────────────────────
    var selectorEl = document.getElementById('contestant-selector');
    var amountGrid = document.getElementById('amount-grid');
    var customAmountInput = document.getElementById('custom-amount-input');
    var customVotesCount = document.getElementById('custom-votes-count');
    var phoneInput = document.getElementById('phone-input');
    var phoneValidation = document.getElementById('phone-validation');
    var summaryContestant = document.getElementById('summary-contestant');
    var summaryAmount = document.getElementById('summary-amount');
    var summaryVotes = document.getElementById('summary-votes');
    var summaryPhone = document.getElementById('summary-phone');
    var payButton = document.getElementById('pay-button');
    var voteResult = document.getElementById('vote-result');
    var resultSuccess = document.getElementById('result-success');
    var resultError = document.getElementById('result-error');
    var resultPending = document.getElementById('result-pending');
    var successMessage = document.getElementById('success-message');
    var errorMessage = document.getElementById('error-message');
    var voteAgainBtn = document.getElementById('vote-again-btn');
    var tryAgainBtn = document.getElementById('try-again-btn');

    // ── Init ───────────────────────────────────────────────────
    async function init() {
        if (!selectorEl) return; // not on vote page

        try {
            var competition = await MalonteAPI.getActiveCompetition();
            contestants = await MalonteAPI.getContestants(competition ? competition.id : null);
            renderContestantSelector(contestants);
            initAmountButtons();
            initCustomAmount();
            initPhoneInput();
            initPayButton();
            initResultButtons();
            handleQueryParams();
        } catch (err) {
            console.error('[Vote] Init error:', err);
            if (window.showToast) showToast('Failed to load voting page', 'error');
        }
    }

    // ── Contestant Selector ────────────────────────────────────
    function renderContestantSelector(list) {
        if (!selectorEl) return;
        selectorEl.innerHTML = '';

        list.forEach(function (contestant) {
            var card = document.createElement('div');
            card.className = 'selector-card';
            card.setAttribute('data-id', contestant.id);

            var photoHTML;
            if (contestant.photo_url && contestant.photo_url.length > 10) {
                photoHTML = '<img src="' + contestant.photo_url + '" alt="' + contestant.name + '">';
            } else {
                photoHTML = MalonteUtils.generateAvatarHTML(contestant.name, 60);
            }

            var demoBadge = '';

            card.innerHTML =
                '<div class="selector-photo">' + photoHTML + '</div>' +
                '<div class="selector-name">' + contestant.name + '</div>' +
                '<div class="selector-votes">' + MalonteUtils.formatNumber(contestant.vote_count) + ' votes</div>' +
                demoBadge;

            card.addEventListener('click', function () {
                selectContestant(contestant, card);
            });

            selectorEl.appendChild(card);
        });
    }

    function selectContestant(contestant, cardEl) {
        // Deselect all
        selectorEl.querySelectorAll('.selector-card').forEach(function (c) {
            c.classList.remove('selected');
        });

        // Select this one
        cardEl.classList.add('selected');
        selectedContestant = contestant;
        updateSummary();
        validateForm();

        // Scroll card into view on mobile
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // ── Amount Buttons ─────────────────────────────────────────
    function initAmountButtons() {
        if (!amountGrid) return;

        var buttons = amountGrid.querySelectorAll('.amount-btn');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                // Deselect all amount buttons
                buttons.forEach(function (b) { b.classList.remove('selected'); });

                // Select this
                btn.classList.add('selected');
                selectedAmount = parseInt(btn.getAttribute('data-amount'), 10);
                selectedVotes = parseInt(btn.getAttribute('data-votes'), 10);

                // Clear custom input
                if (customAmountInput) customAmountInput.value = '';
                if (customVotesCount) customVotesCount.textContent = '0';

                updateSummary();
                validateForm();
            });
        });
    }

    // ── Custom Amount ──────────────────────────────────────────
    function initCustomAmount() {
        if (!customAmountInput) return;

        customAmountInput.addEventListener('input', function () {
            var val = parseInt(this.value, 10);

            // Deselect preset buttons
            if (amountGrid) {
                amountGrid.querySelectorAll('.amount-btn').forEach(function (b) {
                    b.classList.remove('selected');
                });
            }

            if (isNaN(val) || val < 50) {
                selectedAmount = 0;
                selectedVotes = 0;
                if (customVotesCount) customVotesCount.textContent = '0';
            } else {
                // Clamp to max 1000
                if (val > 1000) {
                    val = 1000;
                    this.value = 1000;
                }
                // Round down to nearest 50
                val = Math.floor(val / 50) * 50;
                selectedAmount = val;
                selectedVotes = Math.floor(val / 50);
                if (customVotesCount) customVotesCount.textContent = String(selectedVotes);
            }

            updateSummary();
            validateForm();
        });
    }

    // ── Phone Input ────────────────────────────────────────────
    function initPhoneInput() {
        if (!phoneInput) return;

        function processPhoneInput(el) {
            var raw = el.value.replace(/\D/g, ''); // digits only

            // If user enters/pastes 254... (e.g. 254712345678), strip the 254 because the +254 badge is already on the UI
            if (raw.startsWith('254')) {
                raw = raw.substring(3);
            }

            // If user enters leading 0 (e.g. 07... or 01...), strip the leading 0
            if (raw.startsWith('0')) {
                raw = raw.substring(1);
            }

            // Standard Kenyan mobile numbers are 9 digits (7XXXXXXXX or 1XXXXXXXX)
            if (raw.length > 9) {
                raw = raw.substring(0, 9);
            }

            // Keep the visible input as just the clean local digits (NO duplicate 254 in input!)
            el.value = raw;

            // Full international number (254XXXXXXXXX) for API submission and M-Pesa STK push
            phoneNumber = raw.length > 0 ? '254' + raw : '';

            updatePhoneValidation(raw, phoneNumber);
            updateSummary();
            validateForm();
        }

        phoneInput.addEventListener('input', function () {
            processPhoneInput(this);
        });

        phoneInput.addEventListener('blur', function () {
            processPhoneInput(this);
        });
    }

    function isValidPhone(phone) {
        // Must be 12 digits starting with 254, followed by 7 or 1 (e.g. 254712345678, 254112345678)
        return /^254[71]\d{8}$/.test(phone);
    }

    function updatePhoneValidation(localDigits, fullPhone) {
        if (!phoneValidation) return;

        if (!localDigits || localDigits.length === 0) {
            phoneValidation.style.display = 'none';
            return;
        }

        phoneValidation.style.display = 'flex';

        if (isValidPhone(fullPhone)) {
            phoneValidation.className = 'phone-validation valid';
            phoneValidation.innerHTML = '<i class="fas fa-circle-check"></i> <span>Valid M-Pesa number (+254 ' + localDigits + ')</span>';
        } else if (localDigits.length < 9) {
            var remaining = 9 - localDigits.length;
            phoneValidation.className = 'phone-validation invalid';
            phoneValidation.innerHTML = '<i class="fas fa-circle-info"></i> <span>Enter ' + remaining + ' more digit' + (remaining === 1 ? '' : 's') + '</span>';
        } else {
            phoneValidation.className = 'phone-validation invalid';
            phoneValidation.innerHTML = '<i class="fas fa-circle-xmark"></i> <span>Must start with 7 or 1 (e.g. 712 345 678)</span>';
        }
    }

    // ── Summary ────────────────────────────────────────────────
    function updateSummary() {
        if (summaryContestant) {
            summaryContestant.textContent = selectedContestant ? selectedContestant.name : '—';
        }
        if (summaryAmount) {
            summaryAmount.textContent = selectedAmount > 0 ? MalonteUtils.formatCurrency(selectedAmount) : 'KSh —';
        }
        if (summaryVotes) {
            summaryVotes.textContent = selectedVotes > 0 ? selectedVotes + (selectedVotes === 1 ? ' vote' : ' votes') : '—';
        }
        if (summaryPhone) {
            if (isValidPhone(phoneNumber)) {
                var local = phoneNumber.substring(3);
                summaryPhone.textContent = '+254 ' + local;
            } else {
                summaryPhone.textContent = '—';
            }
        }
    }

    // ── Form Validation ────────────────────────────────────────
    function validateForm() {
        var valid = selectedContestant && selectedAmount >= 50 && selectedAmount <= 1000 && isValidPhone(phoneNumber);
        if (payButton) {
            payButton.disabled = !valid || isProcessing;
        }
        return valid;
    }

    // ── Pay Button ─────────────────────────────────────────────
    function initPayButton() {
        if (!payButton) return;

        payButton.addEventListener('click', async function () {
            if (!validateForm() || isProcessing) return;

            isProcessing = true;
            setButtonLoading(true);
            hideResult();

            // ── Paystack Inline Checkout ──────────────────────────────
            if (
                typeof window.PaystackPop !== 'undefined' &&
                window.PAYSTACK_PUBLIC_KEY &&
                window.PAYSTACK_PUBLIC_KEY !== 'YOUR_PAYSTACK_PUBLIC_KEY' &&
                window.PAYSTACK_PUBLIC_KEY.startsWith('pk_')
            ) {
                try {
                    var handler = window.PaystackPop.setup({
                        key: window.PAYSTACK_PUBLIC_KEY,
                        email: 'voter_' + phoneNumber + '@fashioncrown.co.ke',
                        amount: selectedAmount * 100,
                        currency: 'KES',
                        channels: ['mobile_money', 'card'],
                        mobile_money: {
                            phone: phoneNumber,
                            provider: 'mpesa'
                        },
                        metadata: {
                            custom_fields: [
                                { display_name: 'Contestant', variable_name: 'contestant_name', value: selectedContestant.name },
                                { display_name: 'Contestant ID', variable_name: 'contestant_id', value: selectedContestant.id },
                                { display_name: 'Votes', variable_name: 'votes', value: selectedVotes },
                                { display_name: 'Phone Number', variable_name: 'phone_number', value: phoneNumber }
                            ]
                        },
                        callback: function (response) {
                            var receipt = response.reference || response.trxref || 'PS-' + Date.now();
                            handleSuccess({
                                status: 'completed',
                                mpesa_receipt: receipt,
                                votes: selectedVotes,
                                amount: selectedAmount
                            });
                            setButtonLoading(false);
                            isProcessing = false;
                        },
                        onClose: function () {
                            setButtonLoading(false);
                            isProcessing = false;
                        }
                    });
                    handler.openIframe();
                    return;
                } catch (psErr) {
                    console.warn('[PaystackPop] Error launching inline modal, falling back to direct:', psErr);
                }
            }

            try {
                // Step 1: Initiate STK push
                showResult('pending');
                var response = await MalonteAPI.initiateVote(selectedContestant.id, selectedAmount, phoneNumber);

                if (!response || !response.success) {
                    throw new Error(response ? response.message : 'Failed to initiate payment');
                }

                var checkoutId = response.checkout_request_id || response.checkoutRequestId;
                if (!checkoutId) {
                    throw new Error('No checkout request ID received from payment gateway');
                }

                // Step 2: Poll for payment status
                var maxAttempts = 20; // 60 seconds max
                var attempts = 0;
                var pollResult = null;

                while (attempts < maxAttempts) {
                    await sleep(3000);
                    attempts++;

                    try {
                        pollResult = await MalonteAPI.checkVoteStatus(checkoutId, attempts);
                        if (pollResult && pollResult.status === 'completed') {
                            break;
                        }
                        if (pollResult && pollResult.status === 'failed') {
                            throw new Error(pollResult.result_description || 'Payment was declined');
                        }
                    } catch (pollErr) {
                        if (pollErr.message && !pollErr.message.includes('pending')) {
                            throw pollErr;
                        }
                    }
                }

                if (pollResult && pollResult.status === 'completed') {
                    // Success!
                    handleSuccess(pollResult);
                } else {
                    // Timeout
                    handleError('Payment confirmation timed out. If you were charged, your votes will be credited automatically. Please check your M-Pesa messages.');
                }

            } catch (err) {
                console.error('[Vote] Payment error:', err);
                handleError(err.message || 'Something went wrong. Please try again.');
            } finally {
                isProcessing = false;
                setButtonLoading(false);
            }
        });
    }

    // ── Result Handling ────────────────────────────────────────
    function handleSuccess(result) {
        showResult('success');

        var receipt = result.mpesa_receipt || 'N/A';
        if (successMessage) {
            successMessage.innerHTML =
                '<strong><i class="fa-solid fa-crown" style="color:var(--gold,#C9A84C); margin-right:4px;"></i> ' + selectedVotes + ' vote' + (selectedVotes > 1 ? 's' : '') + '</strong> credited to <strong>' + selectedContestant.name + '</strong>! Elevating them in the Fashion Crown standings.' +
                '<br><small>M-Pesa Receipt: ' + receipt + '</small>';
        }

        // Update local mock data vote count
        if (MalonteAPI._isDemo) {
            var mockC = MalonteAPI._mockData.contestants.find(function (c) { return c.id === selectedContestant.id; });
            if (mockC) mockC.vote_count += selectedVotes;
        }

        // Show gold confetti effect
        triggerConfetti();

        if (window.showToast) {
            showToast('Payment received! ' + selectedVotes + ' votes credited.', 'success');
        }
    }

    function handleError(message) {
        showResult('error');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }

    function showResult(state) {
        if (!voteResult) return;
        voteResult.style.display = 'block';

        if (resultSuccess) resultSuccess.style.display = state === 'success' ? 'block' : 'none';
        if (resultError) resultError.style.display = state === 'error' ? 'block' : 'none';
        if (resultPending) resultPending.style.display = state === 'pending' ? 'block' : 'none';

        // Scroll result into view
        voteResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideResult() {
        if (voteResult) voteResult.style.display = 'none';
        if (resultSuccess) resultSuccess.style.display = 'none';
        if (resultError) resultError.style.display = 'none';
        if (resultPending) resultPending.style.display = 'none';
    }

    function setButtonLoading(loading) {
        if (!payButton) return;
        var btnText = payButton.querySelector('.btn-text');
        var btnLoading = payButton.querySelector('.btn-loading');
        if (btnText) btnText.style.display = loading ? 'none' : 'inline-flex';
        if (btnLoading) btnLoading.style.display = loading ? 'inline-flex' : 'none';
        payButton.disabled = loading;
    }

    // ── Result Buttons ─────────────────────────────────────────
    function initResultButtons() {
        if (voteAgainBtn) {
            voteAgainBtn.addEventListener('click', function () {
                resetForm();
            });
        }

        if (tryAgainBtn) {
            tryAgainBtn.addEventListener('click', function () {
                hideResult();
                isProcessing = false;
                setButtonLoading(false);
                validateForm();
            });
        }
    }

    function resetForm() {
        selectedContestant = null;
        selectedAmount = 0;
        selectedVotes = 0;
        phoneNumber = '';

        // Reset UI
        if (selectorEl) {
            selectorEl.querySelectorAll('.selector-card').forEach(function (c) {
                c.classList.remove('selected');
            });
        }
        if (amountGrid) {
            amountGrid.querySelectorAll('.amount-btn').forEach(function (b) {
                b.classList.remove('selected');
            });
        }
        if (customAmountInput) customAmountInput.value = '';
        if (customVotesCount) customVotesCount.textContent = '0';
        if (phoneInput) phoneInput.value = '';
        if (phoneValidation) phoneValidation.style.display = 'none';

        hideResult();
        updateSummary();
        validateForm();

        // Scroll to top of voting form
        var voteStep1 = document.getElementById('vote-step-1');
        if (voteStep1) voteStep1.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── Query Params ───────────────────────────────────────────
    function handleQueryParams() {
        var params = new URLSearchParams(window.location.search);
        var preselectedId = params.get('id');

        if (preselectedId && selectorEl) {
            var card = selectorEl.querySelector('[data-id="' + preselectedId + '"]');
            if (card) {
                var contestant = contestants.find(function (c) { return c.id === preselectedId; });
                if (contestant) {
                    selectContestant(contestant, card);
                }
            }
        }
    }

    // ── Confetti Effect ────────────────────────────────────────
    function triggerConfetti() {
        var container = document.createElement('div');
        container.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;overflow:hidden;';
        document.body.appendChild(container);

        var colors = ['#D4AF37', '#F0D060', '#FFD700', '#FFF8DC', '#FFFFFF'];
        var particleCount = 60;

        for (var i = 0; i < particleCount; i++) {
            var particle = document.createElement('div');
            var size = Math.random() * 8 + 4;
            var startX = Math.random() * 100;
            var drift = (Math.random() - 0.5) * 40;
            var delay = Math.random() * 600;
            var duration = Math.random() * 2000 + 2000;
            var color = colors[Math.floor(Math.random() * colors.length)];

            particle.style.cssText =
                'position:absolute;top:-10px;left:' + startX + '%;' +
                'width:' + size + 'px;height:' + size + 'px;' +
                'background:' + color + ';border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';' +
                'animation:confettiFall ' + duration + 'ms ease-in ' + delay + 'ms forwards;' +
                'opacity:0;';

            container.appendChild(particle);
        }

        // Add confetti keyframes if not already added
        if (!document.getElementById('confetti-styles')) {
            var style = document.createElement('style');
            style.id = 'confetti-styles';
            style.textContent =
                '@keyframes confettiFall {' +
                '  0% { opacity: 1; transform: translateY(0) rotate(0deg); }' +
                '  100% { opacity: 0; transform: translateY(100vh) rotate(' + (Math.random() * 720) + 'deg); }' +
                '}';
            document.head.appendChild(style);
        }

        // Remove after animation
        setTimeout(function () { container.remove(); }, 4000);
    }

    // ── Helpers ────────────────────────────────────────────────
    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    // ── Run ────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
