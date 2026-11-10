/* =========================================================
   Malonte — Leaderboard Logic  (leaderboard.js)
   Powers leaderboard.html
   ========================================================= */

(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────────
    var currentLeaderboard = [];
    var previousRanks = {};
    var unsubscribe = null;
    var competition = null;

    // ── Init ───────────────────────────────────────────────────
    async function init() {
        var rankingsBody = document.getElementById('rankings-body');
        if (!rankingsBody) return; // not on leaderboard page

        try {
            competition = await MalonteAPI.getActiveCompetition();
            var leaderboard = await MalonteAPI.getLeaderboard(competition ? competition.id : null);
            currentLeaderboard = leaderboard;

            // Store initial ranks
            leaderboard.forEach(function (c) { previousRanks[c.id] = c.rank; });

            renderPodium(leaderboard);
            renderRankingsTable(leaderboard);
            renderStats(leaderboard);
            loadRecentVotes();
            renderCompetitionProgress();
            updateTimeRemaining();

            // Subscribe to real-time updates
            subscribeToUpdates();

            // Fallback polling every 30 seconds
            setInterval(refreshLeaderboard, 30000);

        } catch (err) {
            console.error('[Leaderboard] Init error:', err);
            if (window.showToast) showToast('Failed to load leaderboard', 'error');
        }
    }

    // ── Podium ─────────────────────────────────────────────────
    function renderPodium(leaderboard) {
        if (leaderboard.length < 1) return;

        var positions = [
            { rank: 1, el: '1' },
            { rank: 2, el: '2' },
            { rank: 3, el: '3' }
        ];

        positions.forEach(function (pos) {
            var contestant = leaderboard.find(function (c) { return c.rank === pos.rank; });
            if (!contestant) return;

            var photoEl = document.getElementById('podium-' + pos.el + '-photo');
            var nameEl = document.getElementById('podium-' + pos.el + '-name');
            var votesEl = document.getElementById('podium-' + pos.el + '-votes');

            if (nameEl) nameEl.textContent = contestant.name;
            if (votesEl) votesEl.textContent = MalonteUtils.formatNumber(contestant.vote_count) + ' votes';

            if (photoEl) {
                if (contestant.photo_url && contestant.photo_url.length > 10) {
                    photoEl.innerHTML = '<img src="' + contestant.photo_url + '" alt="' + contestant.name + '">';
                } else {
                    photoEl.innerHTML = '';
                    photoEl.appendChild(MalonteUtils.generateAvatar(contestant.name, pos.rank === 1 ? 90 : 70));
                }
            }
        });
    }

    // ── Rankings Table ─────────────────────────────────────────
    function renderRankingsTable(leaderboard) {
        var tbody = document.getElementById('rankings-body');
        if (!tbody) return;

        var totalVotes = leaderboard.reduce(function (s, c) { return s + c.vote_count; }, 0);

        tbody.innerHTML = '';

        leaderboard.forEach(function (contestant) {
            var row = document.createElement('tr');
            row.className = 'ranking-row';
            row.setAttribute('data-id', contestant.id);

            // Determine rank change
            var prevRank = previousRanks[contestant.id];
            var changeHTML = '<span class="rank-same">—</span>';
            if (prevRank !== undefined && prevRank !== contestant.rank) {
                if (contestant.rank < prevRank) {
                    changeHTML = '<span class="rank-up"><i class="fas fa-arrow-up"></i> ' + (prevRank - contestant.rank) + '</span>';
                } else {
                    changeHTML = '<span class="rank-down"><i class="fas fa-arrow-down"></i> ' + (contestant.rank - prevRank) + '</span>';
                }
            }

            // Rank badge styling
            var rankClass = '';
            if (contestant.rank === 1) rankClass = 'rank-1';
            else if (contestant.rank === 2) rankClass = 'rank-2';
            else if (contestant.rank === 3) rankClass = 'rank-3';

            // Photo
            var photoHTML;
            if (contestant.photo_url && contestant.photo_url.length > 10) {
                photoHTML = '<img src="' + contestant.photo_url + '" alt="' + contestant.name + '" class="ranking-photo">';
            } else {
                photoHTML = MalonteUtils.generateAvatarHTML(contestant.name, 36);
            }

            // Demo badge
            var demoBadge = contestant.is_demo ? ' <span class="badge badge-demo">DEMO</span>' : '';

            // Percentage bar
            var pct = totalVotes > 0 ? ((contestant.vote_count / totalVotes) * 100).toFixed(1) : '0.0';
            var rankBadgeContent = contestant.rank === 1 
                ? '<i class="fas fa-crown" style="font-size: 0.7rem; margin-right: 2px;"></i> 1'
                : contestant.rank;

            row.innerHTML =
                '<td class="col-pos"><span class="rank-badge ' + rankClass + '">' + rankBadgeContent + '</span></td>' +
                '<td class="col-photo hide-mobile">' + photoHTML + '</td>' +
                '<td class="col-name">' + contestant.name + demoBadge + '</td>' +
                '<td class="col-votes">' + MalonteUtils.formatNumber(contestant.vote_count) + '</td>' +
                '<td class="col-pct">' +
                    '<div class="pct-bar-container">' +
                        '<div class="pct-bar-fill" style="width:' + pct + '%"></div>' +
                    '</div>' +
                    '<span class="pct-value">' + pct + '%</span>' +
                '</td>' +
                '<td class="col-change">' + changeHTML + '</td>';

            tbody.appendChild(row);
        });
    }

    // ── Stats ──────────────────────────────────────────────────
    function renderStats(leaderboard) {
        var totalVotes = leaderboard.reduce(function (s, c) { return s + c.vote_count; }, 0);
        var leadingBy = leaderboard.length >= 2 ? leaderboard[0].vote_count - leaderboard[1].vote_count : 0;
        var avgVotes = leaderboard.length > 0 ? Math.round(totalVotes / leaderboard.length) : 0;

        setStatValue('lb-total-votes', MalonteUtils.formatNumber(totalVotes));
        setStatValue('lb-leading-by', MalonteUtils.formatNumber(leadingBy));
        setStatValue('lb-avg-votes', MalonteUtils.formatNumber(avgVotes));

        // Voters count from transactions
        MalonteAPI.getTransactionStats().then(function (stats) {
            setStatValue('lb-voters-count', MalonteUtils.formatNumber(stats.completedCount));
        });
    }

    function setStatValue(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // ── Recent Votes Feed ──────────────────────────────────────
    async function loadRecentVotes() {
        var feed = document.getElementById('recent-votes');
        if (!feed) return;

        try {
            var votes = await MalonteAPI.getRecentVotes(15);
            renderVoteFeed(feed, votes);
        } catch (err) {
            console.warn('[Leaderboard] Recent votes error:', err);
        }
    }

    function renderVoteFeed(container, votes) {
        container.innerHTML = '';

        if (!votes.length) {
            container.innerHTML = '<div class="empty-feed"><i class="fas fa-clock"></i> No votes yet</div>';
            return;
        }

        votes.forEach(function (vote) {
            var item = document.createElement('div');
            item.className = 'vote-feed-item';
            item.innerHTML =
                '<div class="feed-icon"><i class="fas fa-heart"></i></div>' +
                '<div class="feed-content">' +
                    '<div class="feed-text">Someone voted <strong>' + vote.votes + ' vote' + (vote.votes > 1 ? 's' : '') + '</strong> for <strong>' + (vote.contestant_name || 'a contestant') + '</strong></div>' +
                    '<div class="feed-time">' + MalonteUtils.timeAgo(vote.created_at) + '</div>' +
                '</div>';
            container.appendChild(item);
        });
    }

    function prependVoteFeedItem(container, vote) {
        var item = document.createElement('div');
        item.className = 'vote-feed-item vote-feed-new';
        item.innerHTML =
            '<div class="feed-icon"><i class="fas fa-heart"></i></div>' +
            '<div class="feed-content">' +
                '<div class="feed-text">Someone voted <strong>' + vote.votes + ' vote' + (vote.votes > 1 ? 's' : '') + '</strong> for <strong>' + (vote.contestant_name || 'a contestant') + '</strong></div>' +
                '<div class="feed-time">just now</div>' +
            '</div>';

        // Remove placeholder feeds
        container.querySelectorAll('.placeholder-feed').forEach(function (p) { p.remove(); });

        container.insertBefore(item, container.firstChild);

        // Keep max 15 items
        var items = container.querySelectorAll('.vote-feed-item');
        if (items.length > 15) {
            items[items.length - 1].remove();
        }

        // Flash animation
        requestAnimationFrame(function () {
            item.classList.add('feed-enter');
        });
    }

    // ── Competition Progress ───────────────────────────────────
    function renderCompetitionProgress() {
        if (!competition) return;

        var start = new Date(competition.start_date);
        var end = new Date(competition.end_date);
        var now = new Date();
        var totalDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
        var elapsedDays = Math.ceil((now - start) / (24 * 60 * 60 * 1000));
        var currentDay = Math.min(Math.max(elapsedDays, 1), totalDays);
        var progressPct = Math.min(((now - start) / (end - start)) * 100, 100);

        // Progress bar
        var bar = document.getElementById('competition-progress-bar');
        if (bar) bar.style.width = progressPct.toFixed(1) + '%';

        // Labels
        var startLabel = document.getElementById('progress-start-date');
        var endLabel = document.getElementById('progress-end-date');
        var dayLabel = document.getElementById('progress-current-day');

        if (startLabel) startLabel.textContent = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (endLabel) endLabel.textContent = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (dayLabel) dayLabel.textContent = 'Day ' + currentDay + ' of ' + totalDays;

        // Milestones
        for (var i = 1; i <= 7; i++) {
            var milestone = document.getElementById('milestone-' + i);
            if (milestone) {
                var dot = milestone.querySelector('.milestone-dot');
                if (dot && i <= currentDay) {
                    dot.classList.add('active');
                }
            }
        }
    }

    function updateTimeRemaining() {
        if (!competition) return;
        var el = document.getElementById('lb-time-remaining');
        if (!el) return;

        var end = new Date(competition.end_date);
        var now = new Date();
        var diff = end - now;

        if (diff <= 0) {
            el.textContent = 'Competition ended';
            return;
        }

        var days = Math.floor(diff / (24 * 60 * 60 * 1000));
        var hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        el.textContent = days + 'd ' + hours + 'h left';

        // Update every minute
        setTimeout(updateTimeRemaining, 60000);
    }

    // ── Real-time Updates ──────────────────────────────────────
    function subscribeToUpdates() {
        // Subscribe to contestant vote changes
        unsubscribe = MalonteAPI.subscribeToVotes(
            competition ? competition.id : null,
            function (updatedContestant) {
                handleVoteUpdate(updatedContestant);
            }
        );

        // Subscribe to new transactions for the feed
        MalonteAPI.subscribeToTransactions(function (txn) {
            if (txn.status === 'completed') {
                var feed = document.getElementById('recent-votes');
                if (feed) prependVoteFeedItem(feed, txn);
            }
        });
    }

    function handleVoteUpdate(updatedContestant) {
        // Update the local leaderboard
        var found = false;
        currentLeaderboard.forEach(function (c) {
            if (c.id === updatedContestant.id) {
                c.vote_count = updatedContestant.vote_count;
                found = true;
            }
        });

        if (!found) return;

        // Store previous ranks
        currentLeaderboard.forEach(function (c) {
            previousRanks[c.id] = c.rank;
        });

        // Re-sort
        currentLeaderboard.sort(function (a, b) { return b.vote_count - a.vote_count; });

        // Re-assign ranks
        var totalVotes = currentLeaderboard.reduce(function (s, c) { return s + c.vote_count; }, 0);
        currentLeaderboard.forEach(function (c, i) {
            c.rank = i + 1;
            c.percentage = totalVotes > 0 ? ((c.vote_count / totalVotes) * 100).toFixed(1) : '0.0';
        });

        // Re-render
        renderPodium(currentLeaderboard);
        renderRankingsTable(currentLeaderboard);
        renderStats(currentLeaderboard);

        // Highlight changed rows
        var row = document.querySelector('.ranking-row[data-id="' + updatedContestant.id + '"]');
        if (row) {
            row.classList.add('row-flash');
            setTimeout(function () { row.classList.remove('row-flash'); }, 1500);
        }
    }

    // ── Refresh Fallback ───────────────────────────────────────
    async function refreshLeaderboard() {
        try {
            // Store previous ranks
            currentLeaderboard.forEach(function (c) {
                previousRanks[c.id] = c.rank;
            });

            var leaderboard = await MalonteAPI.getLeaderboard(competition ? competition.id : null);
            currentLeaderboard = leaderboard;

            renderPodium(leaderboard);
            renderRankingsTable(leaderboard);
            renderStats(leaderboard);
        } catch (err) {
            console.warn('[Leaderboard] Refresh error:', err);
        }
    }

    // ── Run ────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
