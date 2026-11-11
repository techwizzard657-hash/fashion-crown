/* =========================================================
   Malonte — Admin Dashboard Logic  (admin.js)
   Powers all admin pages.
   ========================================================= */

(function () {
    'use strict';

    // ── Page Detection ─────────────────────────────────────────
    function getAdminPage() {
        var path = window.location.pathname.toLowerCase();
        var file = path.split('/').pop() || '';
        if (file === 'dashboard.html') return 'dashboard';
        if (file === 'manage.html') return 'manage';
        if (file === 'index.html' || file === '') return 'login';
        return 'unknown';
    }

    // ── Toast (admin) ──────────────────────────────────────────
    function showAdminToast(message, type) {
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }
        var container = document.querySelector('.admin-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'admin-toast-container';
            document.body.appendChild(container);
        }
        var bubble = document.createElement('div');
        bubble.className = 'admin-toast-bubble admin-toast-bubble--' + (type || 'info');
        var icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info');
        bubble.innerHTML = '<i class="fa-solid ' + icon + '" style="color:' + (type === 'success' ? '#10B981' : (type === 'error' ? '#EF4444' : '#FF4D6D')) + '"></i><span>' + message + '</span>';
        container.appendChild(bubble);
        setTimeout(function () {
            bubble.style.opacity = '0';
            bubble.style.transform = 'translateX(40px)';
            setTimeout(function () { bubble.remove(); }, 300);
        }, 3500);
    }

    // ── Init ───────────────────────────────────────────────────
    async function init() {
        var page = getAdminPage();

        switch (page) {
            case 'login':
                initLoginPage();
                break;
            case 'dashboard':
                await initDashboard();
                break;
            case 'manage':
                await initManagePage();
                break;
        }

        // Sidebar logic (dashboard + manage pages)
        if (page !== 'login') {
            initSidebar();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // LOGIN PAGE
    // ═══════════════════════════════════════════════════════════
    function initLoginPage() {
        var form = document.getElementById('login-form');
        var errorEl = document.getElementById('login-error');
        if (!form) return;
        // If index.html already attached its own submit handler, skip duplicate
        if (document.getElementById('login-submit')) return;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

            var email = form.querySelector('input[type="email"], #admin-email');
            var password = form.querySelector('input[type="password"], #admin-password');
            var submitBtn = form.querySelector('button[type="submit"], .btn-gold');

            if (!email || !password) return;

            var emailVal = email.value.trim();
            var passVal = password.value;

            if (!emailVal || !passVal) {
                if (errorEl) { errorEl.textContent = 'Please enter email and password.'; errorEl.style.display = 'block'; }
                return;
            }

            // Loading state
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
            }

            try {
                var result = await MalonteAPI.adminLogin(emailVal, passVal);
                if (result && result.success) {
                    
                    window.location.href = 'dashboard.html';
                } else {
                    throw new Error('Login failed');
                }
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message || 'Invalid credentials. Please try again.';
                    errorEl.style.display = 'block';
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // SIDEBAR
    // ═══════════════════════════════════════════════════════════
    function initSidebar() {
        // Active nav item
        var page = getAdminPage();
        document.querySelectorAll('.admin-nav-item, .sidebar-nav a').forEach(function (item) {
            var href = item.getAttribute('href') || item.getAttribute('data-page') || '';
            var itemPage = href.split('/').pop().replace('.html', '');
            if (itemPage === page || (page === 'dashboard' && itemPage === 'dashboard')) {
                item.classList.add('active');
            }
        });

        // Mobile toggle
        var toggleBtn = document.querySelector('.admin-menu-toggle, .sidebar-toggle, [data-sidebar-toggle], #sidebar-toggle');
        var closeBtn = document.querySelector('#sidebar-close, .sidebar-close');
        var sidebar = document.querySelector('.admin-sidebar, .sidebar, #admin-sidebar');
        var overlay = document.querySelector('.sidebar-overlay, .admin-sidebar-overlay, #sidebar-overlay');

        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', function () {
                sidebar.classList.toggle('open');
                sidebar.classList.toggle('active');
                if (overlay) overlay.classList.toggle('active');
            });
        }

        if (closeBtn && sidebar) {
            closeBtn.addEventListener('click', function () {
                sidebar.classList.remove('open');
                sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
            });
        }

        if (overlay && sidebar) {
            overlay.addEventListener('click', function () {
                sidebar.classList.remove('open');
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }

        // Logout
        document.querySelectorAll('.logout-btn, [data-logout], #admin-logout, .sidebar-logout').forEach(function (btn) {
            btn.addEventListener('click', async function (e) {
                e.preventDefault();
                await MalonteAPI.adminLogout();
                window.location.href = 'index.html';
            });
        });
    }

    // ═══════════════════════════════════════════════════════════
    // DASHBOARD
    // ═══════════════════════════════════════════════════════════
    async function initDashboard() {
        await loadDashboardStats();
        await loadRecentTransactions();
        await loadTopContestants();
        await loadCompetitionStatus();
        await loadRevenueChart();
        initQuickActions();
    }

    async function loadDashboardStats() {
        try {
            var stats = await MalonteAPI.getDashboardStats();
            setTextById('stat-revenue', MalonteUtils.formatCurrency(stats.totalRevenue));
            setTextById('stat-votes', MalonteUtils.formatNumber(stats.totalVotes));
            setTextById('stat-contestants', stats.totalContestants);
            setTextById('stat-competitions', stats.totalCompetitions);
        } catch (err) {
            console.error('[Admin] Stats error:', err);
        }
    }

    async function loadRecentTransactions() {
        var table = document.getElementById('recent-transactions');
        if (!table) return;

        try {
            var txns = await MalonteAPI.getRecentTransactions(10);
            var tbody = table.querySelector('tbody') || table;

            tbody.innerHTML = txns.map(function (t) {
                return '<tr>' +
                    '<td>' + formatDateTime(t.created_at) + '</td>' +
                    '<td>' + MalonteUtils.formatPhone(t.phone_number) + '</td>' +
                    '<td>' + MalonteUtils.formatCurrency(t.amount) + '</td>' +
                    '<td>' + (t.contestant_name || '—') + '</td>' +
                    '<td><span class="badge badge-' + t.status + '">' + t.status + '</span></td>' +
                '</tr>';
            }).join('');

        } catch (err) {
            console.error('[Admin] Recent transactions error:', err);
        }
    }

    async function loadTopContestants() {
        var container = document.getElementById('top-contestants');
        if (!container) return;

        try {
            var competition = await MalonteAPI.getActiveCompetition();
            var contestants = await MalonteAPI.getContestants(competition ? competition.id : null);
            var top5 = contestants.slice(0, 5);

            container.innerHTML = top5.map(function (c, i) {
                var rankColors = { 0: '#D4AF37', 1: '#C0C0C0', 2: '#CD7F32' };
                var color = rankColors[i] || '#666';
                return '<div class="top-contestant-item">' +
                    '<span class="top-rank" style="color:' + color + '">#' + (i + 1) + '</span>' +
                    '<div class="top-info">' +
                        '<span class="top-name">' + c.name + (c.is_demo ? ' <small style="color:#666">[DEMO]</small>' : '') + '</span>' +
                        '<span class="top-votes">' + MalonteUtils.formatNumber(c.vote_count) + ' votes</span>' +
                    '</div>' +
                    '<span class="top-revenue">' + MalonteUtils.formatCurrency(c.vote_count * 50) + '</span>' +
                '</div>';
            }).join('');

        } catch (err) {
            console.error('[Admin] Top contestants error:', err);
        }
    }

    async function loadCompetitionStatus() {
        var container = document.getElementById('competition-status');
        if (!container) return;

        try {
            var comp = await MalonteAPI.getActiveCompetition();
            if (!comp) {
                container.innerHTML = '<p class="text-muted">No active competition</p>';
                return;
            }

            var start = new Date(comp.start_date);
            var end = new Date(comp.end_date);
            var now = new Date();
            var totalMs = end - start;
            var elapsedMs = now - start;
            var pct = Math.min(Math.max((elapsedMs / totalMs) * 100, 0), 100);
            var daysLeft = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));

            container.innerHTML =
                '<h4 class="comp-title">' + comp.title + '</h4>' +
                '<div class="comp-progress">' +
                    '<div class="comp-progress-bar"><div class="comp-progress-fill" style="width:' + pct.toFixed(0) + '%"></div></div>' +
                    '<div class="comp-dates">' +
                        '<span>' + start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</span>' +
                        '<span>' + daysLeft + ' days left</span>' +
                        '<span>' + end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</span>' +
                    '</div>' +
                '</div>';

        } catch (err) {
            console.error('[Admin] Competition status error:', err);
        }
    }

    async function loadRevenueChart() {
        var container = document.getElementById('revenue-chart');
        if (!container) return;

        try {
            var data = await MalonteAPI.getRevenueChart(7);
            var maxRevenue = Math.max.apply(null, data.map(function (d) { return d.revenue; }));
            if (maxRevenue === 0) maxRevenue = 1;

            container.innerHTML =
                '<div class="chart-bars">' +
                data.map(function (d) {
                    var height = Math.max((d.revenue / maxRevenue) * 100, 4);
                    return '<div class="chart-bar-group">' +
                        '<div class="chart-bar-value">' + MalonteUtils.formatCurrency(d.revenue) + '</div>' +
                        '<div class="chart-bar" style="height:' + height + '%"></div>' +
                        '<div class="chart-bar-label">' + d.label + '</div>' +
                    '</div>';
                }).join('') +
                '</div>';

        } catch (err) {
            console.error('[Admin] Chart error:', err);
            container.innerHTML = '<div class="chart-empty"><i class="fas fa-chart-bar"></i> Unable to load chart</div>';
        }
    }

    function initQuickActions() {
        document.querySelectorAll('[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-action');
                switch (action) {
                    case 'add-contestant':
                        window.location.href = 'manage.html#contestants';
                        break;
                    case 'create-competition':
                        window.location.href = 'manage.html#competitions';
                        break;
                    case 'export-data':
                        window.location.href = 'manage.html#transactions';
                        break;
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════
    // MANAGE PAGE
    // ═══════════════════════════════════════════════════════════
    var managePage = {
        currentTab: 'contestants',
        editingContestantId: null,
        editingCompetitionId: null,
        transactionPage: 0,
        transactionsPerPage: 20
    };

    async function initManagePage() {
        initTabs();
        await loadContestantsTab();
        await loadCompetitionsTab();
        await loadTransactionsTab();
        initContestantForm();
        initCompetitionForm();
        initTransactionFilters();

        // Handle URL hash for direct tab navigation
        var hash = window.location.hash.replace('#', '');
        if (hash) switchTab(hash);
    }

    // ── Tabs ───────────────────────────────────────────────────
    function initTabs() {
        document.querySelectorAll('.admin-tab, [data-tab]').forEach(function (tab) {
            tab.addEventListener('click', function () {
                var tabName = tab.getAttribute('data-tab') || tab.textContent.toLowerCase().trim();
                switchTab(tabName);
            });
        });
    }

    function switchTab(tabName) {
        managePage.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.admin-tab, [data-tab]').forEach(function (t) {
            var tn = t.getAttribute('data-tab') || t.textContent.toLowerCase().trim();
            t.classList.toggle('active', tn === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content, [data-tab-content]').forEach(function (c) {
            var cn = c.getAttribute('data-tab-content') || c.id.replace('tab-', '');
            c.classList.toggle('active', cn === tabName);
            c.style.display = cn === tabName ? 'block' : 'none';
        });

        // Update URL hash
        window.location.hash = tabName;
    }

    // ── Contestants Tab ────────────────────────────────────────
    async function loadContestantsTab() {
        var table = document.getElementById('contestants-table');
        if (!table) return;

        try {
            var contestants = await MalonteAPI.getContestants();
            var tbody = table.querySelector('tbody') || table;

            if (!contestants.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No contestants yet</td></tr>';
                return;
            }

            tbody.innerHTML = contestants.map(function (c) {
                var photoHTML = (c.photo_url && c.photo_url.length > 10)
                    ? '<img src="' + c.photo_url + '" class="table-thumb">'
                    : MalonteUtils.generateAvatarHTML(c.name, 32);

                return '<tr data-id="' + c.id + '">' +
                    '<td>' + photoHTML + '</td>' +
                    '<td><strong>' + c.name + '</strong></td>' +
                    '<td>Face of Fashion Crown</td>' +
                    '<td>' + MalonteUtils.formatNumber(c.vote_count) + '</td>' +
                    '<td>' + MalonteUtils.formatCurrency(c.vote_count * 50) + '</td>' +
                    '<td><span class="badge badge-success">Active</span></td>' +
                    '<td>' +
                        '<button class="btn-edit" onclick="window.MalonteAdmin.editContestant(\'' + c.id + '\')"><i class="fas fa-pen"></i></button> ' +
                        '<button class="btn-delete" onclick="window.MalonteAdmin.deleteContestant(\'' + c.id + '\', \'' + c.name.replace(/'/g, "\\'") + '\')"><i class="fas fa-trash"></i></button>' +
                    '</td>' +
                '</tr>';
            }).join('');

        } catch (err) {
            console.error('[Admin] Load contestants error:', err);
        }
    }

    function initContestantForm() {
        var form = document.getElementById('add-contestant-form');
        if (!form) return;

        // Photo upload preview
        var photoInput = form.querySelector('input[type="file"], #contestant-photo');
        var uploadZone = form.querySelector('.upload-zone');
        var preview = form.querySelector('.upload-preview, #photo-preview');

        if (uploadZone && photoInput) {
            uploadZone.addEventListener('click', function () { photoInput.click(); });

            uploadZone.addEventListener('dragover', function (e) {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            });
            uploadZone.addEventListener('dragleave', function () {
                uploadZone.classList.remove('dragover');
            });
            uploadZone.addEventListener('drop', function (e) {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                if (e.dataTransfer.files.length) {
                    photoInput.files = e.dataTransfer.files;
                    previewPhoto(e.dataTransfer.files[0]);
                }
            });

            photoInput.addEventListener('change', function () {
                if (this.files.length) previewPhoto(this.files[0]);
            });
        }

        function previewPhoto(file) {
            if (!preview) return;
            var reader = new FileReader();
            reader.onload = function (e) {
                if (preview.tagName === 'IMG') {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                    var content = form.querySelector('#upload-zone-content');
                    if (content) content.style.display = 'none';
                } else {
                    preview.innerHTML = '<img src="' + e.target.result + '" style="max-width:200px;border-radius:12px;">';
                    preview.style.display = 'block';
                }
            };
            reader.readAsDataURL(file);
        }

        // Form submit
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            var nameInput = form.querySelector('#contestant-name, [name="name"]');
            var bioInput = form.querySelector('#contestant-bio, [name="bio"]');
            var isDemoInput = form.querySelector('#contestant-is-demo, #contestant-demo, [name="is_demo"]');
            var compInput = form.querySelector('#contestant-competition, [name="competition_id"]');
            var submitBtn = form.querySelector('button[type="submit"]');

            if (!nameInput || !nameInput.value.trim()) {
                showAdminToast('Contestant name is required', 'error');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Contestant...';
            }

            try {
                var photoUrl = '';
                if (photoInput && photoInput.files && photoInput.files.length) {
                    photoUrl = await MalonteAPI.uploadPhoto(photoInput.files[0]);
                }
                if (!photoUrl) {
                    photoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80&fit=crop';
                }

                var competition = await MalonteAPI.getActiveCompetition();
                var data = {
                    name: nameInput.value.trim(),
                    bio: bioInput ? bioInput.value.trim() : '',
                    photo_url: photoUrl,
                    is_demo: isDemoInput ? isDemoInput.checked : true,
                    competition_id: (compInput && compInput.value) ? compInput.value : (competition ? competition.id : 'nairobi-fw-2025')
                };

                if (managePage.editingContestantId) {
                    await MalonteAPI.updateContestant(managePage.editingContestantId, data);
                    showAdminToast('Contestant updated successfully!', 'success');
                    managePage.editingContestantId = null;
                } else {
                    await MalonteAPI.createContestant(data);
                    showAdminToast('Contestant added successfully to roster!', 'success');
                }

                form.reset();
                if (preview) {
                    if (preview.tagName === 'IMG') {
                        preview.src = '';
                        preview.style.display = 'none';
                        var content = form.querySelector('#upload-zone-content');
                        if (content) content.style.display = '';
                    } else {
                        preview.innerHTML = '';
                        preview.style.display = 'none';
                    }
                }
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Add Contestant to Roster';
                }

                await loadContestantsTab();

            } catch (err) {
                showAdminToast('Error: ' + err.message, 'error');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; }
            }
        });
    }

    // ── Competitions Tab ───────────────────────────────────────
    async function loadCompetitionsTab() {
        var table = document.getElementById('competitions-table');
        if (!table) return;

        try {
            var competitions = await MalonteAPI.getAllCompetitions();
            var tbody = table.querySelector('tbody') || table;

            if (!competitions.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No competitions yet</td></tr>';
                return;
            }

            tbody.innerHTML = competitions.map(function (comp) {
                var status = getCompetitionStatus(comp);
                var statusClass = status === 'Active' ? 'success' : (status === 'Upcoming' ? 'pending' : 'failed');

                return '<tr data-id="' + comp.id + '">' +
                    '<td>' + comp.title + '</td>' +
                    '<td><span class="badge badge-' + statusClass + '">' + status + '</span></td>' +
                    '<td>' + formatDate(comp.start_date) + '</td>' +
                    '<td>' + formatDate(comp.end_date) + '</td>' +
                    '<td>' +
                        '<button class="btn-edit" onclick="window.MalonteAdmin.editCompetition(\'' + comp.id + '\')"><i class="fas fa-pen"></i></button> ' +
                        '<button class="btn-delete" onclick="window.MalonteAdmin.deleteCompetition(\'' + comp.id + '\')"><i class="fas fa-trash"></i></button>' +
                    '</td>' +
                '</tr>';
            }).join('');

        } catch (err) {
            console.error('[Admin] Load competitions error:', err);
        }
    }

    function initCompetitionForm() {
        var form = document.getElementById('create-competition-form');
        if (!form) return;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            var titleInput = form.querySelector('#competition-title, [name="title"]');
            var descInput = form.querySelector('#competition-description, [name="description"]');
            var startInput = form.querySelector('#competition-start, [name="start_date"]');
            var endInput = form.querySelector('#competition-end, [name="end_date"]');
            var submitBtn = form.querySelector('button[type="submit"]');

            if (!titleInput || !titleInput.value.trim()) {
                showAdminToast('Competition title is required', 'error');
                return;
            }
            if (!startInput || !startInput.value || !endInput || !endInput.value) {
                showAdminToast('Start and end dates are required', 'error');
                return;
            }

            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...'; }

            try {
                var data = {
                    title: titleInput.value.trim(),
                    description: descInput ? descInput.value.trim() : '',
                    start_date: new Date(startInput.value).toISOString(),
                    end_date: new Date(endInput.value).toISOString(),
                    status: 'active'
                };

                if (managePage.editingCompetitionId) {
                    await MalonteAPI.updateCompetition(managePage.editingCompetitionId, data);
                    showAdminToast('Competition updated', 'success');
                    managePage.editingCompetitionId = null;
                } else {
                    await MalonteAPI.createCompetition(data);
                    showAdminToast('Competition created', 'success');
                }

                form.reset();
                await loadCompetitionsTab();

            } catch (err) {
                showAdminToast('Error: ' + err.message, 'error');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-plus"></i> Create Competition'; }
            }
        });
    }

    // ── Transactions Tab ───────────────────────────────────────
    async function loadTransactionsTab(filters) {
        var table = document.getElementById('transactions-table');
        if (!table) return;

        try {
            var allFilters = Object.assign({
                limit: managePage.transactionsPerPage,
                offset: managePage.transactionPage * managePage.transactionsPerPage
            }, filters || {});

            var txns = await MalonteAPI.getTransactions(allFilters);
            var tbody = table.querySelector('tbody') || table;

            // Transaction summary
            var stats = await MalonteAPI.getTransactionStats();
            updateTransactionSummary(stats);

            if (!txns.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No transactions found</td></tr>';
                return;
            }

            tbody.innerHTML = txns.map(function (t) {
                return '<tr>' +
                    '<td>' + formatDateTime(t.created_at) + '</td>' +
                    '<td>' + (t.mpesa_receipt || '—') + '</td>' +
                    '<td>' + MalonteUtils.formatPhone(t.phone_number) + '</td>' +
                    '<td>' + MalonteUtils.formatCurrency(t.amount) + '</td>' +
                    '<td>' + t.votes + '</td>' +
                    '<td>' + (t.contestant_name || '—') + '</td>' +
                    '<td><span class="badge badge-' + t.status + '">' + t.status + '</span></td>' +
                '</tr>';
            }).join('');

            renderPagination(stats.totalTransactions);

        } catch (err) {
            console.error('[Admin] Load transactions error:', err);
        }
    }

    function updateTransactionSummary(stats) {
        setTextById('txn-total-count', stats.totalTransactions);
        setTextById('txn-total-revenue', MalonteUtils.formatCurrency(stats.totalRevenue));
        setTextById('txn-success-rate', stats.successRate + '%');
        setTextById('txn-avg-value', stats.totalTransactions > 0
            ? MalonteUtils.formatCurrency(Math.round(stats.totalRevenue / stats.completedCount))
            : 'KSh 0');
    }

    function initTransactionFilters() {
        var filterBtn = document.getElementById('apply-filters');
        var clearBtn = document.getElementById('clear-filters');
        var exportBtn = document.getElementById('export-csv');

        if (filterBtn) {
            filterBtn.addEventListener('click', function () {
                var statusFilter = document.getElementById('filter-status');
                var dateFrom = document.getElementById('filter-date-from');
                var dateTo = document.getElementById('filter-date-to');
                var searchInput = document.getElementById('filter-search');

                var filters = {};
                if (statusFilter && statusFilter.value && statusFilter.value !== 'all') filters.status = statusFilter.value;
                if (dateFrom && dateFrom.value) filters.dateFrom = dateFrom.value;
                if (dateTo && dateTo.value) filters.dateTo = dateTo.value;
                if (searchInput && searchInput.value.trim()) filters.search = searchInput.value.trim();

                managePage.transactionPage = 0;
                loadTransactionsTab(filters);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                var inputs = document.querySelectorAll('#filter-status, #filter-date-from, #filter-date-to, #filter-search');
                inputs.forEach(function (inp) {
                    if (inp.tagName === 'SELECT') inp.selectedIndex = 0;
                    else inp.value = '';
                });
                managePage.transactionPage = 0;
                loadTransactionsTab();
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', async function () {
                try {
                    var txns = await MalonteAPI.getTransactions({ limit: 9999 });
                    exportCSV(txns, 'malonte-transactions.csv');
                    showAdminToast('CSV exported successfully', 'success');
                } catch (err) {
                    showAdminToast('Export failed: ' + err.message, 'error');
                }
            });
        }
    }

    function renderPagination(totalItems) {
        var container = document.getElementById('pagination');
        if (!container) return;

        var totalPages = Math.ceil(totalItems / managePage.transactionsPerPage);
        if (totalPages <= 1) { container.innerHTML = ''; return; }

        var html = '';
        for (var i = 0; i < totalPages; i++) {
            html += '<button class="page-btn' + (i === managePage.transactionPage ? ' active' : '') + '" data-page="' + i + '">' + (i + 1) + '</button>';
        }
        container.innerHTML = html;

        container.querySelectorAll('.page-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                managePage.transactionPage = parseInt(btn.getAttribute('data-page'), 10);
                loadTransactionsTab();
            });
        });
    }

    // ═══════════════════════════════════════════════════════════
    // EXPOSED ADMIN METHODS (for inline onclick handlers)
    // ═══════════════════════════════════════════════════════════
    window.MalonteAdmin = {

        editContestant: async function (id) {
            try {
                var contestant = await MalonteAPI.getContestant(id);
                if (!contestant) return;

                managePage.editingContestantId = id;

                var form = document.getElementById('add-contestant-form');
                if (!form) return;

                var nameInput = form.querySelector('#contestant-name, [name="name"]');
                var bioInput = form.querySelector('#contestant-bio, [name="bio"]');
                var isDemoInput = form.querySelector('#contestant-demo, [name="is_demo"]');
                var submitBtn = form.querySelector('button[type="submit"]');

                if (nameInput) nameInput.value = contestant.name;
                if (bioInput) bioInput.value = contestant.bio || '';
                if (isDemoInput) isDemoInput.checked = contestant.is_demo;
                if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Contestant';

                switchTab('contestants');
                form.scrollIntoView({ behavior: 'smooth' });

            } catch (err) {
                showAdminToast('Error loading contestant: ' + err.message, 'error');
            }
        },

        deleteContestant: async function (id, name) {
            if (!confirm('Are you sure you want to delete ' + (name || 'this contestant') + '? This cannot be undone.')) return;

            try {
                await MalonteAPI.deleteContestant(id);
                showAdminToast('Contestant deleted', 'success');
                await loadContestantsTab();
            } catch (err) {
                showAdminToast('Delete failed: ' + err.message, 'error');
            }
        },

        editCompetition: async function (id) {
            try {
                var comp = await MalonteAPI.getCompetition(id);
                if (!comp) return;

                managePage.editingCompetitionId = id;

                var form = document.getElementById('create-competition-form');
                if (!form) return;

                var titleInput = form.querySelector('#competition-title, [name="title"]');
                var descInput = form.querySelector('#competition-description, [name="description"]');
                var startInput = form.querySelector('#competition-start, [name="start_date"]');
                var endInput = form.querySelector('#competition-end, [name="end_date"]');
                var submitBtn = form.querySelector('button[type="submit"]');

                if (titleInput) titleInput.value = comp.title;
                if (descInput) descInput.value = comp.description || '';
                if (startInput) startInput.value = comp.start_date ? comp.start_date.substring(0, 16) : '';
                if (endInput) endInput.value = comp.end_date ? comp.end_date.substring(0, 16) : '';
                if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Competition';

                switchTab('competitions');
                form.scrollIntoView({ behavior: 'smooth' });

            } catch (err) {
                showAdminToast('Error loading competition: ' + err.message, 'error');
            }
        },

        deleteCompetition: async function (id) {
            if (!confirm('Are you sure you want to delete this competition? All related data will be removed.')) return;

            try {
                await MalonteAPI.deleteCompetition(id);
                showAdminToast('Competition deleted', 'success');
                await loadCompetitionsTab();
            } catch (err) {
                showAdminToast('Delete failed: ' + err.message, 'error');
            }
        }
    };

    // ═══════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════
    function setTextById(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function getCompetitionStatus(comp) {
        var now = new Date();
        var start = new Date(comp.start_date);
        var end = new Date(comp.end_date);
        if (now < start) return 'Upcoming';
        if (now > end) return 'Ended';
        return 'Active';
    }

    function exportCSV(data, filename) {
        if (!data || !data.length) return;

        var headers = ['Date', 'Receipt', 'Phone', 'Amount (KSh)', 'Votes', 'Contestant', 'Status'];
        var rows = data.map(function (t) {
            return [
                formatDateTime(t.created_at),
                t.mpesa_receipt || '',
                MalonteUtils.formatPhone(t.phone_number),
                t.amount,
                t.votes,
                t.contestant_name || '',
                t.status
            ].map(function (val) {
                return '"' + String(val).replace(/"/g, '""') + '"';
            }).join(',');
        });

        var csv = headers.join(',') + '\n' + rows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // ── Run ────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
