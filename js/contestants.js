/* =========================================================
   Malonte — Contestants Page Logic  (contestants.js)
   Additional logic specific to contestants.html
   (app.js handles core init; this file adds extra features)
   ========================================================= */

(function () {
    'use strict';

    // This file supplements app.js for the contestants page.
    // app.js already handles: loading contestants, rendering cards,
    // search, sort, and stats. This file adds real-time updates
    // and the countdown timer connection.

    async function init() {
        var container = document.getElementById('contestants-container');
        if (!container) return; // not on contestants page

        try {
            var competition = await MalonteAPI.getActiveCompetition();

            // Set countdown data
            var countdownEl = document.querySelector('.countdown-timer, #countdown-timer');
            if (countdownEl && competition && !countdownEl.getAttribute('data-end')) {
                countdownEl.setAttribute('data-end', competition.end_date);
            }

            // Init countdown if available
            if (window.MalonteCountdown) {
                window.MalonteCountdown.init();
            }

            // Subscribe to real-time vote updates
            MalonteAPI.subscribeToVotes(
                competition ? competition.id : null,
                function (updatedContestant) {
                    // Update vote count in the displayed cards
                    var cards = container.querySelectorAll('[data-id="' + updatedContestant.id + '"]');
                    cards.forEach(function (card) {
                        var voteEl = card.querySelector('.vote-count, strong');
                        if (voteEl) {
                            voteEl.textContent = MalonteUtils.formatNumber(updatedContestant.vote_count);
                        }
                        card.setAttribute('data-votes', updatedContestant.vote_count);

                        // Brief highlight
                        card.classList.add('vote-updated');
                        setTimeout(function () { card.classList.remove('vote-updated'); }, 1500);
                    });

                    // Update stats
                    var statEl = document.querySelector('[data-stat="total-votes"]');
                    if (statEl) {
                        // Recalculate — simple approach: add the diff
                        var allCards = container.querySelectorAll('[data-votes]');
                        var total = 0;
                        allCards.forEach(function (c) { total += parseInt(c.getAttribute('data-votes') || '0', 10); });
                        statEl.textContent = MalonteUtils.formatNumber(total);
                    }
                }
            );

        } catch (err) {
            console.warn('[Contestants] Extra init error:', err);
        }
    }

    // Run after a short delay to let app.js populate the page first
    function delayedInit() {
        setTimeout(init, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', delayedInit);
    } else {
        delayedInit();
    }

})();
