/* =========================================================
   Malonte — Countdown Timer  (countdown.js)
   ========================================================= */

(function () {
    'use strict';

    var timers = [];

    var MalonteCountdown = {

        init: async function () {
            var elements = document.querySelectorAll('.countdown-timer, #countdown-timer');
            if (!elements.length) return;

            // Try to get competition end date
            var endDate = null;
            try {
                var comp = await MalonteAPI.getActiveCompetition();
                if (comp && comp.end_date) endDate = new Date(comp.end_date);
            } catch (e) {
                console.warn('[Countdown] Could not get competition:', e.message);
            }

            elements.forEach(function (el) {
                var elEnd = el.getAttribute('data-end');
                var target = elEnd ? new Date(elEnd) : endDate;

                if (!target || isNaN(target.getTime())) {
                    el.innerHTML = '<div class="countdown-message">No active competition</div>';
                    return;
                }

                // Build countdown DOM structure if not already present
                if (!el.querySelector('.countdown-unit')) {
                    buildCountdownDOM(el);
                }

                startTimer(el, target);
            });
        },

        destroy: function () {
            timers.forEach(function (id) { clearInterval(id); });
            timers = [];
        }
    };

    function buildCountdownDOM(el) {
        var units = ['days', 'hours', 'minutes', 'seconds'];
        var labels = ['Days', 'Hours', 'Minutes', 'Seconds'];

        el.innerHTML = '';

        units.forEach(function (unit, i) {
            var unitDiv = document.createElement('div');
            unitDiv.className = 'countdown-unit';

            var numberDiv = document.createElement('div');
            numberDiv.className = 'countdown-number';
            numberDiv.setAttribute('data-unit', unit);
            numberDiv.textContent = '00';

            var labelDiv = document.createElement('div');
            labelDiv.className = 'countdown-label';
            labelDiv.textContent = labels[i];

            unitDiv.appendChild(numberDiv);
            unitDiv.appendChild(labelDiv);
            el.appendChild(unitDiv);

            // Add separator between units (except after last)
            if (i < units.length - 1) {
                var sep = document.createElement('div');
                sep.className = 'countdown-separator';
                sep.textContent = ':';
                el.appendChild(sep);
            }
        });
    }

    function startTimer(el, target) {
        function tick() {
            var now = Date.now();
            var diff = target.getTime() - now;

            if (diff <= 0) {
                // Competition ended
                handleCompletion(el);
                return false; // signal to stop
            }

            var days = Math.floor(diff / (1000 * 60 * 60 * 24));
            var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            var seconds = Math.floor((diff % (1000 * 60)) / 1000);

            updateUnit(el, 'days', days);
            updateUnit(el, 'hours', hours);
            updateUnit(el, 'minutes', minutes);
            updateUnit(el, 'seconds', seconds);

            return true; // keep going
        }

        // Initial tick
        if (!tick()) return;

        // Subsequent ticks every second
        var intervalId = setInterval(function () {
            if (!tick()) {
                clearInterval(intervalId);
            }
        }, 1000);

        timers.push(intervalId);
    }

    function updateUnit(container, unit, value) {
        var el = container.querySelector('[data-unit="' + unit + '"]');
        if (!el) return;

        var formatted = pad(value);
        var current = el.textContent;

        if (current !== formatted) {
            el.textContent = formatted;

            // Trigger flip animation
            el.classList.remove('flip');
            // Force reflow
            void el.offsetWidth;
            el.classList.add('flip');
        }
    }

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function handleCompletion(el) {
        el.classList.add('ended');

        // Zero out all units
        var units = el.querySelectorAll('.countdown-number');
        units.forEach(function (u) { u.textContent = '00'; });

        // Show ended message
        var msg = document.createElement('div');
        msg.className = 'countdown-ended-message';
        msg.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> COMPETITION ENDED';
        el.appendChild(msg);

        // Disable voting buttons on the page
        document.querySelectorAll('.btn-vote, .btn-gold[href*="vote"], #vote-submit, .vote-btn').forEach(function (btn) {
            btn.classList.add('disabled');
            btn.setAttribute('disabled', 'disabled');
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
            if (btn.tagName === 'A') {
                btn.addEventListener('click', function (e) { e.preventDefault(); });
            }
        });
    }

    // Expose globally
    window.MalonteCountdown = MalonteCountdown;

    // Auto-init on DOM ready (if not called by app.js first)
    var autoInitDone = false;
    function autoInit() {
        if (autoInitDone) return;
        autoInitDone = true;
        // Small delay to let app.js set data-end attributes
        setTimeout(function () {
            MalonteCountdown.init();
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

})();
