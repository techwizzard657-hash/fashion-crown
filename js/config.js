/* =========================================================
   Malonte — Config Bridge  (config.js)
   Loads Supabase configuration for public-facing pages.
   This file is loaded BEFORE app.js on public pages.
   ========================================================= */

// This file acts as a lightweight loader/bridge.
// The full API layer lives in supabase.js — we inline-load it
// so public pages only need to reference config.js.

(function () {
    'use strict';

    // ── Configuration ──────────────────────────────────────────
    var SUPABASE_URL = 'YOUR_SUPABASE_URL';
    var SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    var PAYSTACK_PUBLIC_KEY = 'YOUR_PAYSTACK_PUBLIC_KEY'; // e.g. pk_live_... or pk_test_...

    window.PAYSTACK_PUBLIC_KEY = PAYSTACK_PUBLIC_KEY;

    // ── Client Initialisation ──────────────────────────────────
    var supabaseClient = null;
    var isSupabaseConnected = false;

    try {
        if (
            window.supabase &&
            SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
            SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
        ) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            isSupabaseConnected = true;
            console.log('[Malonte] Supabase connected');
        } else {
            console.warn('[Malonte] Supabase not configured — running in demo/mock mode');
        }
    } catch (err) {
        console.error('[Malonte] Supabase initialisation failed:', err);
    }

    // ── Mock Data ──────────────────────────────────────────────
    var MOCK_DATA = {
        competition: {
            id: 'comp-1',
            title: 'Fashion Crown Kenya 2026',
            description:
                'Vote for your favourite fashion designer and help them claim the prestigious Fashion Crown! The top 3 contestants walk away with major cash prizes, brand endorsements, and an exclusive feature in Fashion Crown Magazine.',
            start_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },

        contestants: [
            {
                id: 'cont-1',
                name: 'Amara Okafor',
                bio: 'High-fashion editorial model & runway muse. Leading contender for the official Face of Fashion Crown 2026.',
                photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=face',
                is_demo: false,
                vote_count: 847,
                competition_id: 'comp-1',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'cont-2',
                name: 'Liam Chen',
                bio: 'Streetwear & editorial model with international runway acclaim. Contender for the Face of Fashion Crown.',
                photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop&crop=face',
                is_demo: false,
                vote_count: 623,
                competition_id: 'comp-1',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'cont-3',
                name: 'Sofia Martinez',
                bio: 'Haute couture editorial model and luxury brand muse with 10 years of runway experience.',
                photo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop&crop=face',
                is_demo: false,
                vote_count: 512,
                competition_id: 'comp-1',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'cont-4',
                name: 'David Kimani',
                bio: 'Nairobi-based high-fashion model and style icon. Representing modern contemporary Kenyan elegance.',
                photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&crop=face',
                is_demo: false,
                vote_count: 389,
                competition_id: 'comp-1',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'cont-5',
                name: "Zara Ndung'u",
                bio: 'Top style ambassador, editorial model, and creative muse. Finalist for the New Face of Fashion Crown.',
                photo_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop&crop=face',
                is_demo: false,
                vote_count: 256,
                competition_id: 'comp-1',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'cont-6',
                name: 'Malik Adebayo',
                bio: 'International menswear and luxury editorial ambassador. Known for striking contemporary and classic editorial style.',
                photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop&crop=face',
                is_demo: false,
                vote_count: 215,
                competition_id: 'comp-1',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'cont-7',
                name: 'Nia Wambui',
                bio: 'Avant-garde runway model and beauty editorial ambassador with a strong presence in East African fashion week.',
                photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop&crop=face',
                is_demo: false,
                vote_count: 178,
                competition_id: 'comp-1',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'cont-8',
                name: 'Chloe Vance',
                bio: 'High-fashion editorial and haute couture muse, acclaimed for minimalist and luxury campaign editorials.',
                photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop&crop=face',
                is_demo: false,
                vote_count: 142,
                competition_id: 'comp-1',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
        ],

        transactions: generateMockTransactions()
    };

    function generateMockTransactions() {
        var names = ['Amara Okafor', 'Liam Chen', 'Sofia Martinez', 'David Kimani', "Zara Ndung'u", 'Malik Adebayo', 'Nia Wambui', 'Chloe Vance'];
        var contestantIds = ['cont-1', 'cont-2', 'cont-3', 'cont-4', 'cont-5', 'cont-6', 'cont-7', 'cont-8'];
        var statuses = ['completed', 'completed', 'completed', 'completed', 'completed',
                        'completed', 'completed', 'completed', 'pending', 'failed'];
        var amounts = [50, 100, 150, 200, 250, 300, 500, 1000];
        var phones = ['254712345678', '254723456789', '254734567890', '254745678901', '254756789012',
                      '254767890123', '254778901234', '254789012345', '254790123456', '254701234567'];
        var txns = [];

        for (var i = 0; i < 20; i++) {
            var ci = Math.floor(Math.random() * names.length);
            var amount = amounts[Math.floor(Math.random() * amounts.length)];
            var status = statuses[Math.floor(Math.random() * statuses.length)];
            var hoursAgo = Math.floor(Math.random() * 48);
            txns.push({
                id: 'txn-' + (i + 1),
                contestant_id: contestantIds[ci],
                contestant_name: names[ci],
                phone_number: phones[Math.floor(Math.random() * phones.length)],
                amount: amount,
                votes: Math.floor(amount / 50),
                status: status,
                mpesa_receipt: status === 'completed'
                    ? 'SH' + Math.random().toString(36).substring(2, 12).toUpperCase()
                    : null,
                checkout_request_id: 'ws_CO_' + Date.now() + '_' + i,
                created_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
            });
        }

        txns.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        return txns;
    }

    // ── Helpers ────────────────────────────────────────────────
    function cloneMock(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function mockDelay(ms) {
        if (ms === undefined) ms = 300 + Math.random() * 400;
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    // ── API Object ─────────────────────────────────────────────
    window.MalonteAPI = {

        isConnected: function () { return isSupabaseConnected; },

        // ── Competition Methods ────────────────────────────────
        getActiveCompetition: async function () {
            try {
                if (isSupabaseConnected) {
                    var now = new Date().toISOString();
                    var result = await supabaseClient
                        .from('competitions')
                        .select('*')
                        .lte('start_date', now)
                        .gte('end_date', now)
                        .eq('status', 'active')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] getActiveCompetition fallback:', err.message);
            }
            await mockDelay();
            return cloneMock(MOCK_DATA.competition);
        },

        getCompetition: async function (id) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient
                        .from('competitions').select('*').eq('id', id).single();
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] getCompetition fallback:', err.message);
            }
            await mockDelay();
            return MOCK_DATA.competition.id === id ? cloneMock(MOCK_DATA.competition) : null;
        },

        getAllCompetitions: async function () {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient
                        .from('competitions').select('*').order('created_at', { ascending: false });
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] getAllCompetitions fallback:', err.message);
            }
            await mockDelay();
            return [cloneMock(MOCK_DATA.competition)];
        },

        createCompetition: async function (data) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient
                        .from('competitions').insert([data]).select().single();
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] createCompetition fallback:', err.message);
            }
            await mockDelay();
            return Object.assign({ id: 'comp-' + Date.now(), status: 'active', created_at: new Date().toISOString() }, data);
        },

        updateCompetition: async function (id, data) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient
                        .from('competitions').update(data).eq('id', id).select().single();
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] updateCompetition fallback:', err.message);
            }
            await mockDelay();
            return Object.assign(cloneMock(MOCK_DATA.competition), data);
        },

        deleteCompetition: async function (id) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient.from('competitions').delete().eq('id', id);
                    if (result.error) throw result.error;
                    return true;
                }
            } catch (err) {
                console.warn('[MalonteAPI] deleteCompetition fallback:', err.message);
            }
            await mockDelay();
            return true;
        },

        // ── Contestant Methods ─────────────────────────────────
        getContestants: async function (competitionId) {
            try {
                if (isSupabaseConnected) {
                    var query = supabaseClient
                        .from('contestants').select('*').order('vote_count', { ascending: false });
                    if (competitionId) query = query.eq('competition_id', competitionId);
                    var result = await query;
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] getContestants fallback:', err.message);
            }
            await mockDelay();
            var list = cloneMock(MOCK_DATA.contestants);
            if (competitionId) list = list.filter(function (c) { return c.competition_id === competitionId; });
            list.sort(function (a, b) { return b.vote_count - a.vote_count; });
            return list;
        },

        getContestant: async function (id) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient.from('contestants').select('*').eq('id', id).single();
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] getContestant fallback:', err.message);
            }
            await mockDelay();
            var found = MOCK_DATA.contestants.find(function (c) { return c.id === id; });
            return found ? cloneMock(found) : null;
        },

        createContestant: async function (data) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient
                        .from('contestants').insert([Object.assign({ vote_count: 0 }, data)]).select().single();
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] createContestant fallback:', err.message);
            }
            await mockDelay();
            var newC = Object.assign({ id: 'cont-' + Date.now(), vote_count: 0, created_at: new Date().toISOString() }, data);
            MOCK_DATA.contestants.push(newC);
            return cloneMock(newC);
        },

        updateContestant: async function (id, data) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient
                        .from('contestants').update(data).eq('id', id).select().single();
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] updateContestant fallback:', err.message);
            }
            await mockDelay();
            var idx = MOCK_DATA.contestants.findIndex(function (c) { return c.id === id; });
            if (idx !== -1) Object.assign(MOCK_DATA.contestants[idx], data);
            return idx !== -1 ? cloneMock(MOCK_DATA.contestants[idx]) : null;
        },

        deleteContestant: async function (id) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient.from('contestants').delete().eq('id', id);
                    if (result.error) throw result.error;
                    return true;
                }
            } catch (err) {
                console.warn('[MalonteAPI] deleteContestant fallback:', err.message);
            }
            await mockDelay();
            MOCK_DATA.contestants = MOCK_DATA.contestants.filter(function (c) { return c.id !== id; });
            return true;
        },

        uploadPhoto: async function (file) {
            try {
                if (isSupabaseConnected) {
                    var filename = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    var uploadResult = await supabaseClient.storage.from('contestant-photos').upload(filename, file, { cacheControl: '3600', upsert: false });
                    if (uploadResult.error) throw uploadResult.error;
                    var urlResult = supabaseClient.storage.from('contestant-photos').getPublicUrl(uploadResult.data.path);
                    return urlResult.data.publicUrl;
                }
            } catch (err) {
                console.warn('[MalonteAPI] uploadPhoto fallback:', err.message);
            }
            return new Promise(function (resolve) {
                var reader = new FileReader();
                reader.onload = function (e) { resolve(e.target.result); };
                reader.readAsDataURL(file);
            });
        },

        // ── Transaction Methods ────────────────────────────────
        getTransactions: async function (filters) {
            try {
                if (isSupabaseConnected) {
                    var query = supabaseClient
                        .from('transactions')
                        .select('*, contestants(name)')
                        .order('created_at', { ascending: false });
                    if (filters) {
                        if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
                        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
                        if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');
                        if (filters.search) {
                            query = query.or('phone_number.ilike.%' + filters.search + '%,mpesa_receipt.ilike.%' + filters.search + '%');
                        }
                        if (filters.limit) query = query.limit(filters.limit);
                        if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
                    }
                    var result = await query;
                    if (result.error) throw result.error;
                    return result.data.map(function (t) {
                        if (t.contestants) t.contestant_name = t.contestants.name;
                        return t;
                    });
                }
            } catch (err) {
                console.warn('[MalonteAPI] getTransactions fallback:', err.message);
            }
            await mockDelay();
            var txns = cloneMock(MOCK_DATA.transactions);
            if (filters) {
                if (filters.status && filters.status !== 'all') txns = txns.filter(function (t) { return t.status === filters.status; });
                if (filters.dateFrom) txns = txns.filter(function (t) { return t.created_at >= filters.dateFrom; });
                if (filters.dateTo) txns = txns.filter(function (t) { return t.created_at <= filters.dateTo + 'T23:59:59'; });
                if (filters.search) {
                    var s = filters.search.toLowerCase();
                    txns = txns.filter(function (t) {
                        return (t.phone_number && t.phone_number.toLowerCase().includes(s)) ||
                               (t.mpesa_receipt && t.mpesa_receipt.toLowerCase().includes(s)) ||
                               (t.contestant_name && t.contestant_name.toLowerCase().includes(s));
                    });
                }
                if (filters.offset) txns = txns.slice(filters.offset);
                if (filters.limit) txns = txns.slice(0, filters.limit);
            }
            return txns;
        },

        getRecentTransactions: async function (limit) {
            return this.getTransactions({ limit: limit || 10 });
        },

        getTransactionStats: async function () {
            try {
                if (isSupabaseConnected) {
                    var pub = await supabaseClient.rpc('get_public_stats');
                    if (!pub.error && pub.data) {
                        return {
                            totalRevenue: pub.data.total_raised || 0,
                            totalTransactions: pub.data.completed_transactions || 0,
                            completedCount: pub.data.completed_transactions || 0,
                            failedCount: 0,
                            pendingCount: 0,
                            successRate: 100
                        };
                    }
                    var result = await supabaseClient.from('transactions').select('amount, status');
                    if (result.error) throw result.error;
                    var total = 0, completed = 0, failed = 0, pending = 0;
                    result.data.forEach(function (t) {
                        if (t.status === 'completed') { total += t.amount; completed++; }
                        else if (t.status === 'failed') { failed++; }
                        else { pending++; }
                    });
                    return { totalRevenue: total, totalTransactions: result.data.length, completedCount: completed, failedCount: failed, pendingCount: pending, successRate: result.data.length > 0 ? Math.round((completed / result.data.length) * 100) : 0 };
                }
            } catch (err) {
                console.warn('[FashionCrownAPI] getTransactionStats fallback:', err.message);
            }
            await mockDelay();
            var txns = MOCK_DATA.transactions;
            var total = 0, completed = 0, failed = 0, pending = 0;
            txns.forEach(function (t) {
                if (t.status === 'completed') { total += t.amount; completed++; }
                else if (t.status === 'failed') { failed++; }
                else { pending++; }
            });
            return { totalRevenue: total, totalTransactions: txns.length, completedCount: completed, failedCount: failed, pendingCount: pending, successRate: txns.length > 0 ? Math.round((completed / txns.length) * 100) : 0 };
        },

        // ── Voting Methods ─────────────────────────────────────
        initiateVote: async function (contestantId, amount, phoneNumber) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient.functions.invoke('mpesa-stk-push', {
                        body: { contestant_id: contestantId, amount: amount, phone_number: phoneNumber }
                    });
                    if (result.error) throw result.error;
                    return result.data;
                }
            } catch (err) {
                console.warn('[MalonteAPI] initiateVote fallback:', err.message);
            }
            await mockDelay(1500);
            return { success: true, checkout_request_id: 'ws_CO_DEMO_' + Date.now(), message: 'STK push sent (demo mode)' };
        },

        checkVoteStatus: async function (checkoutRequestId, attemptNumber) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient.rpc('get_vote_status', {
                        p_checkout_request_id: checkoutRequestId
                    });
                    if (result.error) throw result.error;

                    // If still pending after attempt 4 (~12s), actively query Safaricom
                    if (result.data && result.data.status === 'pending' && attemptNumber && attemptNumber >= 4) {
                        try {
                            var queryRes = await supabaseClient.functions.invoke('mpesa-query', {
                                body: { checkoutRequestId: checkoutRequestId }
                            });
                            if (queryRes.data && queryRes.data.status && queryRes.data.status !== 'pending') {
                                return queryRes.data;
                            }
                        } catch (qErr) {
                            console.warn('[FashionCrownAPI] mpesa-query check:', qErr.message);
                        }
                    }

                    return result.data;
                }
            } catch (err) {
                console.warn('[FashionCrownAPI] checkVoteStatus fallback:', err.message);
            }
            await mockDelay(500);
            if (checkoutRequestId && checkoutRequestId.includes('DEMO')) {
                return {
                    status: 'completed',
                    mpesa_receipt: 'SH' + Math.random().toString(36).substring(2, 12).toUpperCase(),
                    checkout_request_id: checkoutRequestId
                };
            }
            return { status: 'pending' };
        },

        getRecentVotes: async function (limit) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient
                        .from('public_transactions')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(limit || 20);
                    if (result.error) throw result.error;
                    return result.data.map(function (t) {
                        t.phone_number = t.phone_masked;
                        return t;
                    });
                }
            } catch (err) {
                console.warn('[FashionCrownAPI] getRecentVotes fallback:', err.message);
            }
            await mockDelay();
            return cloneMock(MOCK_DATA.transactions).filter(function (t) { return t.status === 'completed'; }).slice(0, limit || 20);
        },

        // ── Stats Methods ──────────────────────────────────────
        getDashboardStats: async function () {
            try {
                if (isSupabaseConnected) {
                    var results = await Promise.all([
                        this.getTransactionStats(),
                        supabaseClient.from('contestants').select('id', { count: 'exact', head: true }),
                        supabaseClient.from('competitions').select('id', { count: 'exact', head: true })
                    ]);
                    return {
                        totalRevenue: results[0].totalRevenue,
                        totalVotes: Math.floor(results[0].totalRevenue / 50),
                        totalContestants: results[1].count || 0,
                        totalCompetitions: results[2].count || 0,
                        successRate: results[0].successRate,
                        totalTransactions: results[0].totalTransactions
                    };
                }
            } catch (err) {
                console.warn('[MalonteAPI] getDashboardStats fallback:', err.message);
            }
            await mockDelay();
            var totalVotes = MOCK_DATA.contestants.reduce(function (s, c) { return s + c.vote_count; }, 0);
            var revenue = totalVotes * 50;
            var txnStats = await this.getTransactionStats();
            return {
                totalRevenue: revenue,
                totalVotes: totalVotes,
                totalContestants: MOCK_DATA.contestants.length,
                totalCompetitions: 1,
                successRate: txnStats.successRate,
                totalTransactions: txnStats.totalTransactions
            };
        },

        getLeaderboard: async function (competitionId) {
            var contestants = await this.getContestants(competitionId);
            var totalVotes = contestants.reduce(function (s, c) { return s + c.vote_count; }, 0);
            return contestants.map(function (c, i) {
                return Object.assign({}, c, {
                    rank: i + 1,
                    percentage: totalVotes > 0 ? ((c.vote_count / totalVotes) * 100).toFixed(1) : '0.0'
                });
            });
        },

        getRevenueChart: async function (days) {
            try {
                if (isSupabaseConnected) {
                    var since = new Date(Date.now() - (days || 7) * 24 * 60 * 60 * 1000).toISOString();
                    var result = await supabaseClient
                        .from('transactions').select('amount, created_at')
                        .eq('status', 'completed').gte('created_at', since).order('created_at', { ascending: true });
                    if (result.error) throw result.error;
                    return buildDailyRevenue(result.data, days || 7);
                }
            } catch (err) {
                console.warn('[MalonteAPI] getRevenueChart fallback:', err.message);
            }
            await mockDelay();
            var chartData = [];
            for (var i = (days || 7) - 1; i >= 0; i--) {
                var d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                chartData.push({
                    date: d.toISOString().split('T')[0],
                    label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                    revenue: Math.floor(Math.random() * 8000) + 1000
                });
            }
            return chartData;
        },

        // ── Auth Methods ───────────────────────────────────────
        adminLogin: async function (email, password) {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
                    if (result.error) throw result.error;
                    return { success: true, user: result.data.user };
                }
            } catch (err) {
                console.warn('[MalonteAPI] adminLogin fallback:', err.message);
            }
            await mockDelay(800);
            var demoUser = { id: 'demo-admin', email: email, role: 'admin' };
            sessionStorage.setItem('malonte_demo_admin', JSON.stringify(demoUser));
            return { success: true, user: demoUser, demo: true };
        },

        adminLogout: async function () {
            try {
                if (isSupabaseConnected) { await supabaseClient.auth.signOut(); }
            } catch (err) { console.warn('[MalonteAPI] adminLogout:', err.message); }
            sessionStorage.removeItem('malonte_demo_admin');
            return true;
        },

        getSession: async function () {
            try {
                if (isSupabaseConnected) {
                    var result = await supabaseClient.auth.getSession();
                    return result.data.session;
                }
            } catch (err) { console.warn('[MalonteAPI] getSession:', err.message); }
            var demo = sessionStorage.getItem('malonte_demo_admin');
            return demo ? { user: JSON.parse(demo), demo: true } : null;
        },

        isAdmin: async function () {
            var session = await this.getSession();
            return !!session;
        },

        // ── Real-time ──────────────────────────────────────────
        subscribeToVotes: function (competitionId, callback) {
            if (isSupabaseConnected) {
                var channel = supabaseClient
                    .channel('contestant-votes')
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contestants' }, function (payload) {
                        if (!competitionId || payload.new.competition_id === competitionId) {
                            callback(payload.new);
                        }
                    })
                    .subscribe();
                return function () { supabaseClient.removeChannel(channel); };
            }
            // Demo mode: simulate random vote updates
            var interval = setInterval(function () {
                var contestants = MOCK_DATA.contestants;
                var randomIdx = Math.floor(Math.random() * contestants.length);
                var c = contestants[randomIdx];
                var addVotes = Math.floor(Math.random() * 5) + 1;
                c.vote_count += addVotes;
                callback(cloneMock(c));
            }, 8000 + Math.random() * 7000);
            return function () { clearInterval(interval); };
        },

        subscribeToTransactions: function (callback) {
            if (isSupabaseConnected) {
                var channel = supabaseClient
                    .channel('transactions-feed')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, function (payload) {
                        callback(payload.new);
                    })
                    .subscribe();
                return function () { supabaseClient.removeChannel(channel); };
            }
            var interval = setInterval(function () {
                var names = ['Amara Okafor', 'Liam Chen', 'Sofia Martinez', 'David Kimani', "Zara Ndung'u"];
                var ids = ['cont-1', 'cont-2', 'cont-3', 'cont-4', 'cont-5'];
                var ci = Math.floor(Math.random() * names.length);
                var amount = (Math.floor(Math.random() * 20) + 1) * 50;
                callback({
                    id: 'txn-live-' + Date.now(), contestant_id: ids[ci], contestant_name: names[ci],
                    amount: amount, votes: Math.floor(amount / 50), status: 'completed', created_at: new Date().toISOString()
                });
            }, 10000 + Math.random() * 10000);
            return function () { clearInterval(interval); };
        },

        _mockData: MOCK_DATA,
        _isDemo: !isSupabaseConnected
    };

    function buildDailyRevenue(transactions, days) {
        var buckets = {};
        for (var i = days - 1; i >= 0; i--) {
            var d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            var key = d.toISOString().split('T')[0];
            buckets[key] = { date: key, label: d.toLocaleDateString('en-US', { weekday: 'short' }), revenue: 0 };
        }
        transactions.forEach(function (t) {
            var key = t.created_at.split('T')[0];
            if (buckets[key]) buckets[key].revenue += t.amount;
        });
        return Object.values(buckets);
    }

    window.FashionCrownAPI = window.MalonteAPI;
    window.FashionCrownUtils = window.MalonteUtils;

    console.log('[Fashion Crown] Config loaded —', isSupabaseConnected ? 'LIVE' : 'DEMO MODE');
})();
