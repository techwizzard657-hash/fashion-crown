/* =========================================================
   Malonte — Main Application Logic  (app.js)
   Runs on every page.
   ========================================================= */

(function () {
    'use strict';

    // ── Utility Functions (exposed globally) ───────────────
    window.MalonteUtils = {

        /** 1,234 */
        formatNumber: function (n) {
            if (n === null || n === undefined) return '0';
            return Number(n).toLocaleString('en-US');
        },

        /** KSh 1,234 */
        formatCurrency: function (n) {
            if (n === null || n === undefined) return 'KSh 0';
            return 'KSh ' + Number(n).toLocaleString('en-US');
        },

        /** 254***678 */
        formatPhone: function (phone) {
            if (!phone) return '—';
            var s = String(phone);
            if (s.length < 6) return s;
            return s.substring(0, 3) + '***' + s.substring(s.length - 3);
        },

        /** "2 minutes ago" */
        timeAgo: function (date) {
            if (!date) return '—';
            var now = Date.now();
            var past = new Date(date).getTime();
            var diff = Math.floor((now - past) / 1000);

            if (diff < 5) return 'just now';
            if (diff < 60) return diff + ' seconds ago';
            if (diff < 120) return '1 minute ago';
            if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago';
            if (diff < 7200) return '1 hour ago';
            if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
            if (diff < 172800) return '1 day ago';
            if (diff < 2592000) return Math.floor(diff / 86400) + ' days ago';
            return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        },

        /** Generate an avatar div with initials + gold gradient background */
        generateAvatar: function (name, size) {
            size = size || 80;
            var initials = (name || '?')
                .split(' ')
                .map(function (w) { return w.charAt(0).toUpperCase(); })
                .slice(0, 2)
                .join('');

            // Deterministic hue from name for slight colour variation (gold family)
            var hash = 0;
            for (var i = 0; i < (name || '').length; i++) {
                hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
            }
            var hue = 35 + (Math.abs(hash) % 20); // 35-55 (gold range)
            var sat = 55 + (Math.abs(hash >> 4) % 25);

            var div = document.createElement('div');
            div.className = 'avatar-initials';
            div.textContent = initials;
            div.style.cssText =
                'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
                'display:flex;align-items:center;justify-content:center;' +
                'font-family:"Playfair Display",serif;font-weight:700;color:#111;' +
                'font-size:' + Math.round(size * 0.38) + 'px;' +
                'background:linear-gradient(135deg,hsl(' + hue + ',' + sat + '%,65%),hsl(' + hue + ',' + sat + '%,45%));' +
                'flex-shrink:0;user-select:none;text-transform:uppercase;';
            return div;
        },

        /** Generate avatar HTML string (for innerHTML use) */
        generateAvatarHTML: function (name, size) {
            size = size || 80;
            var initials = (name || '?')
                .split(' ')
                .map(function (w) { return w.charAt(0).toUpperCase(); })
                .slice(0, 2)
                .join('');

            var hash = 0;
            for (var i = 0; i < (name || '').length; i++) {
                hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
            }
            var hue = 35 + (Math.abs(hash) % 20);
            var sat = 55 + (Math.abs(hash >> 4) % 25);

            return '<div class="avatar-initials" style="' +
                'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
                'display:flex;align-items:center;justify-content:center;' +
                'font-family:\'Playfair Display\',serif;font-weight:700;color:#111;' +
                'font-size:' + Math.round(size * 0.38) + 'px;' +
                'background:linear-gradient(135deg,hsl(' + hue + ',' + sat + '%,65%),hsl(' + hue + ',' + sat + '%,45%));' +
                'flex-shrink:0;user-select:none;text-transform:uppercase;">' +
                initials + '</div>';
        }
    };
    window.FashionCrownUtils = window.MalonteUtils;

    // ── Toast Notifications ────────────────────────────────
    var toastContainer = null;

    function ensureToastContainer() {
        if (toastContainer) return;
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;' +
            'gap:10px;pointer-events:none;max-width:380px;width:calc(100% - 40px);';
        document.body.appendChild(toastContainer);
    }

    window.showToast = function (message, type) {
        type = type || 'info';
        ensureToastContainer();

        var icons = {
            success: 'fa-circle-check',
            error: 'fa-circle-xmark',
            info: 'fa-circle-info',
            warning: 'fa-triangle-exclamation'
        };
        var colors = {
            success: '#10B981',
            error: '#EF4444',
            info: '#D4AF37',
            warning: '#F59E0B'
        };

        var toast = document.createElement('div');
        toast.style.cssText =
            'background:#1A1A1A;border:1px solid #2A2A2A;border-left:4px solid ' + (colors[type] || colors.info) + ';' +
            'border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;' +
            'color:#fff;font-family:"Inter",sans-serif;font-size:14px;pointer-events:auto;' +
            'box-shadow:0 8px 32px rgba(0,0,0,0.4);opacity:0;transform:translateX(40px);' +
            'transition:opacity 0.3s ease,transform 0.3s ease;';

        toast.innerHTML =
            '<i class="fa-solid ' + (icons[type] || icons.info) + '" style="color:' + (colors[type] || colors.info) + ';font-size:18px;flex-shrink:0;"></i>' +
            '<span style="flex:1;">' + message + '</span>' +
            '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#666;cursor:pointer;font-size:16px;padding:0 4px;">' +
            '<i class="fa-solid fa-xmark"></i></button>';

        toastContainer.appendChild(toast);

        // Trigger enter animation
        requestAnimationFrame(function () {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        // Auto-dismiss
        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            setTimeout(function () { toast.remove(); }, 300);
        }, 4500);
    };

    // ── Navigation ─────────────────────────────────────────
    function initNavigation() {
        // Mobile hamburger toggle
        var toggle = document.querySelector('.nav-toggle, .hamburger, [data-nav-toggle]');
        var navMenu = document.querySelector('.nav-links, .nav-menu, [data-nav-menu]');

        if (toggle && navMenu) {
            toggle.addEventListener('click', function (e) {
                e.stopPropagation();
                navMenu.classList.toggle('active');
                toggle.classList.toggle('active');

                // Toggle aria-expanded
                var expanded = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', String(!expanded));
            });

            // Close menu on link click
            navMenu.querySelectorAll('a').forEach(function (link) {
                link.addEventListener('click', function () {
                    navMenu.classList.remove('active');
                    toggle.classList.remove('active');
                    toggle.setAttribute('aria-expanded', 'false');
                });
            });

            // Close menu on outside click
            document.addEventListener('click', function (e) {
                if (!navMenu.contains(e.target) && !toggle.contains(e.target)) {
                    navMenu.classList.remove('active');
                    toggle.classList.remove('active');
                    toggle.setAttribute('aria-expanded', 'false');
                }
            });
        }

        // Active page highlighting
        var currentPath = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-links a, .nav-menu a').forEach(function (link) {
            var href = link.getAttribute('href');
            if (!href) return;
            var linkPage = href.split('/').pop().split('?')[0].split('#')[0];
            if (linkPage === currentPath || (currentPath === '' && linkPage === 'index.html')) {
                link.classList.add('active');
            }
        });
    }

    // ── Scroll Animations ──────────────────────────────────
    function initScrollAnimations() {
        var elements = document.querySelectorAll('.scroll-animate');
        if (!elements.length) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        elements.forEach(function (el) { observer.observe(el); });
    }

    // ── Number Counter Animation ───────────────────────────
    function animateCounter(element, target, duration) {
        duration = duration || 1500;
        target = parseInt(target, 10);
        if (isNaN(target)) return;

        var start = 0;
        var startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            // Ease-out cubic
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.floor(eased * target);
            element.textContent = MalonteUtils.formatNumber(current);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                element.textContent = MalonteUtils.formatNumber(target);
            }
        }
        requestAnimationFrame(step);
    }

    function initCounterAnimations() {
        var counters = document.querySelectorAll('[data-count], .stat-number, .counter');
        if (!counters.length) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var el = entry.target;
                    var target = el.getAttribute('data-count') || el.textContent.replace(/[^0-9]/g, '');
                    if (target) animateCounter(el, target);
                    observer.unobserve(el);
                }
            });
        }, { threshold: 0.3 });

        counters.forEach(function (el) { observer.observe(el); });
    }

    // ── Page Detection & Init ──────────────────────────────
    function detectPage() {
        var path = window.location.pathname.toLowerCase();
        var file = path.split('/').pop() || 'index.html';
        if (file === '' || file === 'index.html') return 'home';
        if (file === 'contestants.html') return 'contestants';
        if (file === 'vote.html') return 'vote';
        if (file === 'leaderboard.html') return 'leaderboard';
        if (path.includes('/admin/')) {
            if (file === 'index.html' || file === 'login.html') return 'admin-login';
            if (file === 'dashboard.html') return 'admin-dashboard';
            if (file === 'manage.html') return 'admin-manage';
            return 'admin';
        }
        return file.replace('.html', '');
    }

    // ── Homepage Initialisation ────────────────────────────
    async function initHomepage() {
        try {
            var competition = await MalonteAPI.getActiveCompetition();
            var contestants = await MalonteAPI.getContestants(competition ? competition.id : null);

            // Populate stats bar
            populateHomeStats(competition, contestants);

            // Populate featured contestants as horizontal detailed cards (matches screenshot)
            var grid = document.getElementById('contestants-grid');
            if (grid && contestants.length) {
                var sorted = contestants.slice().sort(function (a, b) {
                    return (b.vote_count || 0) - (a.vote_count || 0);
                });
                grid.innerHTML = '';
                sorted.forEach(function (contestant, index) {
                    grid.appendChild(createDetailedContestantCard(contestant, index + 1));
                });
                initScrollAnimations();
            }

            // Store competition info for countdown
            if (competition) {
                var countdownEl = document.querySelector('.countdown-timer, #countdown-timer');
                if (countdownEl && !countdownEl.getAttribute('data-end')) {
                    countdownEl.setAttribute('data-end', competition.end_date);
                }
            }

            // Init countdown if module is loaded
            if (window.MalonteCountdown) {
                window.MalonteCountdown.init();
            }

        } catch (err) {
            console.error('[Malonte] Homepage init error:', err);
            showToast('Failed to load competition data', 'error');
        }
    }

    function populateHomeStats(competition, contestants) {
        var totalVotes = contestants.reduce(function (s, c) { return s + c.vote_count; }, 0);
        var totalContestants = contestants.length;
        var daysRemaining = 0;
        var totalContributions = totalVotes * 50;

        if (competition && competition.end_date) {
            daysRemaining = Math.max(0, Math.ceil((new Date(competition.end_date) - Date.now()) / (24 * 60 * 60 * 1000)));
        }

        // Update stat elements by data-stat attribute or by order
        var statMap = {
            'total-votes': MalonteUtils.formatNumber(totalVotes),
            'contestants': totalContestants,
            'days-remaining': daysRemaining,
            'contributions': MalonteUtils.formatCurrency(totalContributions)
        };

        Object.keys(statMap).forEach(function (key) {
            var el = document.querySelector('[data-stat="' + key + '"]');
            if (el) {
                el.setAttribute('data-count', String(statMap[key]).replace(/[^0-9]/g, ''));
                el.textContent = statMap[key];
            }
        });

        // Also try numbered stat blocks (fallback)
        var statNumbers = document.querySelectorAll('.stats-bar .stat-number, .hero-stats .stat-number');
        if (statNumbers.length >= 4) {
            var values = [totalVotes, totalContestants, daysRemaining, totalContributions];
            var formatters = [MalonteUtils.formatNumber, String, String, MalonteUtils.formatCurrency];
            statNumbers.forEach(function (el, i) {
                if (i < values.length) {
                    el.textContent = formatters[i](values[i]);
                    el.setAttribute('data-count', values[i]);
                }
            });
        }
    }

    function createContestantCard(contestant) {
        var card = document.createElement('div');
        card.className = 'contestant-card scroll-animate';
        card.setAttribute('data-id', contestant.id);

        var photoHTML;
        if (contestant.photo_url && contestant.photo_url.length > 10) {
            photoHTML = '<img src="' + contestant.photo_url + '" alt="' + contestant.name + '" loading="lazy">';
        } else {
            photoHTML = MalonteUtils.generateAvatarHTML(contestant.name, 200);
        }

        var demoBadge = '';

        card.innerHTML =
            '<div class="contestant-photo">' +
                photoHTML +
                demoBadge +
            '</div>' +
            '<div class="contestant-info">' +
                '<h3 class="contestant-name">' + contestant.name + '</h3>' +
                '<p class="contestant-bio">' + (contestant.bio || '') + '</p>' +
                '<div class="contestant-votes">' +
                    '<i class="fa-solid fa-heart" style="color:var(--accent-pink,#FF4D6D);"></i> ' +
                    '<span class="vote-count">' + MalonteUtils.formatNumber(contestant.vote_count) + '</span> votes' +
                '</div>' +
                '<button type="button" class="btn btn-gold btn-vote btn-quick-vote" data-id="' + contestant.id + '" data-name="' + encodeURIComponent(contestant.name) + '" data-photo="' + encodeURIComponent(contestant.photo_url || '') + '">' +
                    '<i class="fa-solid fa-crown"></i> Vote for New Face' +
                '</button>' +
            '</div>';

        return card;
    }

    // ── Contestants Page Initialisation ────────────────────
    async function initContestantsPage() {
        try {
            var competition = await MalonteAPI.getActiveCompetition();
            var contestants = await MalonteAPI.getContestants(competition ? competition.id : null);

            renderContestantsList(contestants);
            initContestantsSearch(contestants);
            initContestantsSort(contestants);
            updateContestantsStats(contestants);

        } catch (err) {
            console.error('[Malonte] Contestants page init error:', err);
            showToast('Failed to load contestants', 'error');
        }
    }

    function renderContestantsList(contestants) {
        var container = document.getElementById('contestants-container');
        if (!container) return;

        if (!contestants.length) {
            container.innerHTML =
                '<div class="empty-state">' +
                    '<i class="fa-solid fa-users-slash" style="font-size:48px;color:#D4AF37;margin-bottom:16px;"></i>' +
                    '<h3>No Contestants Yet</h3>' +
                    '<p>Check back soon for the latest fashion icons.</p>' +
                '</div>';
            return;
        }

        container.innerHTML = '';
        contestants.forEach(function (contestant, index) {
            var card = createDetailedContestantCard(contestant, index + 1);
            container.appendChild(card);
        });

        // Re-run scroll animations
        initScrollAnimations();
    }

    function createDetailedContestantCard(contestant, rank) {
        var card = document.createElement('div');
        card.className = 'contestant-card-detailed scroll-animate';
        card.setAttribute('data-id', contestant.id);
        card.setAttribute('data-name', contestant.name.toLowerCase());
        card.setAttribute('data-votes', contestant.vote_count);

        var photoHTML;
        if (contestant.photo_url && contestant.photo_url.length > 10) {
            photoHTML = '<img src="' + contestant.photo_url + '" alt="' + contestant.name + '" loading="lazy">';
        } else {
            photoHTML = MalonteUtils.generateAvatarHTML(contestant.name, 200);
        }

        var demoBadge = '';

        var rankBadge = '';
        if (rank === 1) {
            rankBadge = '<span class="rank-badge" style="background:#FF4D6D;color:#FFFFFF;font-weight:700;"><i class="fa-solid fa-crown"></i> Crown Leader</span>';
        } else if (rank <= 3) {
            var rankColors = { 2: '#A89E8A', 3: '#806A50' };
            var rankIcons = { 2: 'fa-medal', 3: 'fa-award' };
            rankBadge = '<span class="rank-badge" style="background:' + rankColors[rank] + ';color:#FFFFFF;">' +
                '<i class="fa-solid ' + rankIcons[rank] + '"></i> #' + rank + '</span>';
        } else {
            rankBadge = '<span class="rank-badge">#' + rank + '</span>';
        }

        card.innerHTML =
            '<div class="contestant-card-left">' +
                '<div class="contestant-photo">' + photoHTML + demoBadge + '</div>' +
            '</div>' +
            '<div class="contestant-card-body">' +
                '<div class="contestant-card-header">' +
                    '<h3 class="contestant-name">' + contestant.name + '</h3>' +
                    rankBadge +
                '</div>' +
                '<p class="contestant-bio">' + (contestant.bio || '') + '</p>' +
                '<div class="contestant-card-footer">' +
                    '<div class="contestant-votes">' +
                        '<i class="fa-solid fa-heart" style="color:var(--accent-pink,#FF4D6D);"></i> ' +
                        '<strong>' + MalonteUtils.formatNumber(contestant.vote_count) + '</strong> votes' +
                    '</div>' +
                    '<button type="button" class="btn-vote-pill btn-quick-vote" data-id="' + contestant.id + '" data-name="' + encodeURIComponent(contestant.name) + '" data-photo="' + encodeURIComponent(contestant.photo_url || '') + '">' +
                        '<i class="fa-solid fa-crown"></i> Vote for New Face' +
                    '</button>' +
                '</div>' +
            '</div>';

        return card;
    }

    function initContestantsSearch(allContestants) {
        var searchInput = document.getElementById('contestant-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', function () {
            var query = this.value.toLowerCase().trim();
            var filtered = allContestants.filter(function (c) {
                return c.name.toLowerCase().includes(query) ||
                       (c.bio && c.bio.toLowerCase().includes(query));
            });
            renderContestantsList(filtered);
        });
    }

    function initContestantsSort(allContestants) {
        var sortSelect = document.getElementById('contestant-sort');
        if (!sortSelect) return;

        sortSelect.addEventListener('change', function () {
            var val = this.value;
            var sorted = allContestants.slice();
            switch (val) {
                case 'votes-desc':
                    sorted.sort(function (a, b) { return b.vote_count - a.vote_count; });
                    break;
                case 'votes-asc':
                    sorted.sort(function (a, b) { return a.vote_count - b.vote_count; });
                    break;
                case 'name-asc':
                    sorted.sort(function (a, b) { return a.name.localeCompare(b.name); });
                    break;
                case 'name-desc':
                    sorted.sort(function (a, b) { return b.name.localeCompare(a.name); });
                    break;
                default:
                    sorted.sort(function (a, b) { return b.vote_count - a.vote_count; });
            }
            renderContestantsList(sorted);
        });
    }

    function updateContestantsStats(contestants) {
        var totalVotes = contestants.reduce(function (s, c) { return s + c.vote_count; }, 0);
        var leader = contestants.length ? contestants[0] : null;

        var statsMap = {
            'total-contestants': contestants.length,
            'total-votes': MalonteUtils.formatNumber(totalVotes),
            'leading-contestant': leader ? leader.name : '—',
            'leading-votes': leader ? MalonteUtils.formatNumber(leader.vote_count) : '0'
        };

        Object.keys(statsMap).forEach(function (key) {
            var el = document.querySelector('[data-stat="' + key + '"]');
            if (el) el.textContent = statsMap[key];
        });
    }

    // ── Global Init ────────────────────────────────────────
    function init() {
        initNavigation();
        initScrollAnimations();
        initCounterAnimations();
        initQuickVoteModal();

        // Show demo mode banner
        if (window.MalonteAPI && window.MalonteAPI._isDemo) {
            showDemoBanner();
        }

        // Page-specific init
        var page = detectPage();
        switch (page) {
            case 'home':
                initHomepage();
                break;
            case 'contestants':
                initContestantsPage();
                break;
            // vote, leaderboard, admin handled by their own JS files
        }
    }

    function showDemoBanner() {
        return; // Production mode: demo banner disabled
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }


    // ── Quick Vote Modal Logic ────────────────────────────────
    function initQuickVoteModal() {
        var overlay = document.getElementById('quick-vote-overlay');
        var closeBtn = document.getElementById('quick-vote-close');
        var avatar = document.getElementById('qv-avatar');
        var nameEl = document.getElementById('qv-name');
        var pills = document.querySelectorAll('.quick-vote-pill');
        var phoneInput = document.getElementById('qv-phone');
        var submitBtn = document.getElementById('qv-submit-btn');
        var btnText = document.getElementById('qv-btn-text');
        var statusBox = document.getElementById('qv-status-box');

        if (!overlay) return;

        var selectedContestant = null;
        var selectedAmount = 50;
        var selectedVotes = 1;
        var isSubmitting = false;

        // Open modal
        window.openQuickVote = function (contestantId, contestantName, photoUrl) {
            selectedContestant = { id: contestantId, name: contestantName, photo_url: photoUrl };
            if (nameEl) nameEl.textContent = contestantName;
            if (avatar) {
                avatar.src = photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&fit=crop';
                avatar.alt = contestantName;
            }
            selectedAmount = 50;
            selectedVotes = 1;
            pills.forEach(function (p) {
                p.classList.toggle('selected', p.getAttribute('data-votes') === '1');
            });
            if (btnText) btnText.textContent = 'Pay KSh 50 with M-Pesa (1 Vote)';
            if (statusBox) { statusBox.style.display = 'none'; statusBox.innerHTML = ''; }
            if (submitBtn) { submitBtn.disabled = false; }
            overlay.classList.add('active');
        };

        // Close modal
        function closeModal() {
            if (isSubmitting) return;
            overlay.classList.remove('active');
        }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });

        // Pill selection
        pills.forEach(function (pill) {
            pill.addEventListener('click', function () {
                var amt = pill.getAttribute('data-amount');
                var vts = pill.getAttribute('data-votes');
                if (amt === 'custom') {
                    var custom = prompt('Enter custom amount in multiples of KSh 50 (e.g. 500, 1000):', '500');
                    if (!custom || isNaN(custom) || Number(custom) < 50 || Number(custom) % 50 !== 0) {
                        alert('Please enter a valid amount in multiples of KSh 50 (minimum KSh 50)');
                        return;
                    }
                    selectedAmount = Number(custom);
                    selectedVotes = selectedAmount / 50;
                } else {
                    selectedAmount = Number(amt);
                    selectedVotes = Number(vts);
                }
                pills.forEach(function (p) { p.classList.remove('selected'); });
                pill.classList.add('selected');
                if (btnText) btnText.textContent = 'Pay KSh ' + MalonteUtils.formatNumber(selectedAmount) + ' with M-Pesa (' + selectedVotes + ' ' + (selectedVotes === 1 ? 'Vote' : 'Votes') + ')';
            });
        });

        // Phone input formatting (strips leading 0 or pasted 254)
        if (phoneInput) {
            phoneInput.addEventListener('input', function () {
                var val = this.value.replace(/[^0-9]/g, '');
                if (val.startsWith('254') && val.length > 3) {
                    val = val.slice(3);
                }
                if (val.startsWith('0') && val.length > 1) {
                    val = val.slice(1);
                }
                this.value = val;
            });
        }

        // Submit vote
        if (submitBtn) {
            submitBtn.addEventListener('click', async function () {
                if (isSubmitting || !selectedContestant) return;

                var rawPhone = phoneInput ? phoneInput.value.trim().replace(/[^0-9]/g, '') : '';
                if (!rawPhone || rawPhone.length !== 9 || (!rawPhone.startsWith('7') && !rawPhone.startsWith('1'))) {
                    if (statusBox) {
                        statusBox.style.display = 'block';
                        statusBox.style.background = '#FEE2E2';
                        statusBox.style.color = '#B91C1C';
                        statusBox.style.border = '1px solid #FCA5A5';
                        statusBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Enter a valid 9-digit Safaricom number (e.g. 712 345 678)';
                    }
                    return;
                }

                var fullPhone = '254' + rawPhone;
                isSubmitting = true;
                submitBtn.disabled = true;
                if (btnText) btnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending STK Push to Phone...';

                if (statusBox) {
                    statusBox.style.display = 'block';
                    statusBox.style.background = 'rgba(255, 77, 109, 0.1)';
                    statusBox.style.color = '#FF4D6D';
                    statusBox.style.border = '1.5px solid #FF4D6D';
                    statusBox.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i> Check your phone (+254 ' + rawPhone + ') and enter your <strong>M-Pesa PIN</strong> to complete payment.';
                }

                try {
                    var response = await MalonteAPI.initiateVote(selectedContestant.id, selectedAmount, fullPhone);
                    
                    // Poll or wait for verification
                    await new Promise(function (res) { setTimeout(res, 3500); });

                    // Increment vote count locally on cards in background
                    var countEls = document.querySelectorAll('.contestant-card[data-id="' + selectedContestant.id + '"] .vote-count, .contestant-card-detailed[data-id="' + selectedContestant.id + '"] strong');
                    countEls.forEach(function (el) {
                        var curr = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0;
                        el.textContent = MalonteUtils.formatNumber(curr + selectedVotes);
                    });

                    // Success state
                    if (statusBox) {
                        statusBox.style.background = '#ECFDF5';
                        statusBox.style.color = '#065F46';
                        statusBox.style.border = '1.5px solid #10B981';
                        statusBox.innerHTML = '<i class="fa-solid fa-circle-check" style="font-size:1.2rem;"></i><br><strong style="font-size:1.05rem;">Payment Confirmed!</strong><br>' + selectedVotes + ' ' + (selectedVotes === 1 ? 'vote' : 'votes') + ' credited to ' + selectedContestant.name + '!';
                    }

                    if (btnText) btnText.innerHTML = '<i class="fa-solid fa-crown"></i> Vote Credited Successfully!';
                    submitBtn.style.background = 'linear-gradient(135deg, #10B981, #059669)';

                    setTimeout(function () {
                        closeModal();
                        isSubmitting = false;
                        submitBtn.style.background = '';
                    }, 3500);

                } catch (err) {
                    if (statusBox) {
                        statusBox.style.background = '#FEE2E2';
                        statusBox.style.color = '#B91C1C';
                        statusBox.style.border = '1px solid #FCA5A5';
                        statusBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + (err.message || 'Payment initiation failed. Please try again.');
                    }
                    if (btnText) btnText.textContent = 'Try Again';
                    submitBtn.disabled = false;
                    isSubmitting = false;
                }
            });
        }

        // Delegate click for dynamically rendered contestant cards
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.btn-quick-vote');
            if (btn) {
                e.preventDefault();
                var id = btn.getAttribute('data-id');
                var name = decodeURIComponent(btn.getAttribute('data-name') || '');
                var photo = decodeURIComponent(btn.getAttribute('data-photo') || '');
                window.openQuickVote(id, name, photo);
            }
        });
    }


        initQuickVoteModal();
})();