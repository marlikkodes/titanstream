#!/usr/bin/env python3
"""
TitanStream Local Development API Server (Python Fallback Runner)
Serves API endpoints on port 3001 for local manual testing when Node is host-only.
"""

import json
import os
import random
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3001
SESSIONS_FILE = '/tmp/titan_dev_mining_sessions.json'

def load_dev_sessions():
    if os.path.exists(SESSIONS_FILE):
        try:
            with open(SESSIONS_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_dev_sessions(sessions):
    try:
        with open(SESSIONS_FILE, 'w') as f:
            json.dump(sessions, f, indent=2)
    except Exception as e:
        print('Failed to save dev sessions:', e)

DEV_SESSIONS = load_dev_sessions()

def get_user_session(user_id='default_user'):
    now = time.time()
    if user_id not in DEV_SESSIONS:
        DEV_SESSIONS[user_id] = {
            'telegramUserId': user_id,
            'activeCurrency': 'USDT',
            'baseSpeedGhs': 1.0,
            'coolerMultiplier': 1.0,
            'unclaimedBalance': 0.0256,
            'usdtBalance': 0.0,
            'tonBalance': 0.0,
            'crystalsBalance': 50,
            'machineMode': 'PROMOTIONAL',
            'lifetimePromotionalOutput': 0.0,
            'interactivePromotionalOutput': 0.0,
            'isOverheated': False,
            'cooldownRemaining': 0,
            'tapYieldPerTap': 0.02,
            'lastUpdatedAt': now,
        }
        save_dev_sessions(DEV_SESSIONS)
    
    s = DEV_SESSIONS[user_id]
    # Accrue passive yield (1.0 Gh/s = ~$0.00001 / sec)
    elapsed = now - s.get('lastUpdatedAt', now)
    if elapsed > 0 and not s.get('isOverheated', False):
        yield_accrued = elapsed * 0.00001 * s.get('baseSpeedGhs', 1.0) * s.get('coolerMultiplier', 1.0)
        s['unclaimedBalance'] = round(s.get('unclaimedBalance', 0.0) + yield_accrued, 6)
        s['lastUpdatedAt'] = now
        save_dev_sessions(DEV_SESSIONS)
    return s

class TitanDevServer(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data, X-Telegram-User-Id, X-StepUp-Token')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _get_user_id(self):
        uid = self.headers.get('X-Telegram-User-Id') or self.headers.get('Authorization') or 'default_user'
        return uid.replace('Bearer ', '').strip()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data, X-Telegram-User-Id, X-StepUp-Token')
        self.end_headers()

    def do_GET(self):
        user_id = self._get_user_id()
        session = get_user_session(user_id)

        if self.path in ['/health', '/api/v1/health']:
            return self._send_json({'status': 'ok', 'service': 'TitanStream API', 'version': '1.0.1', 'timestamp': time.time()})
        elif self.path in ['/docs', '/api/v1/docs']:
            return self._send_json({'title': 'TitanStream API Docs', 'endpoints': ['/api/v1/mining/state', '/api/v1/financial/balance']})
        elif '/api/v1/mining/state' in self.path:
            return self._send_json({
                'success': True,
                'data': session
            })
        elif '/api/v1/financial/balance' in self.path:
            return self._send_json({
                'success': True,
                'data': {
                    'usdtBalance': session.get('usdtBalance', 0.0),
                    'tonBalance': session.get('tonBalance', 0.0),
                    'crystalsBalance': session.get('crystalsBalance', 50),
                    'pendingUsdt': 0.0,
                    'activeMachines': 1
                }
            })
        elif '/api/v1/machines/my' in self.path:
            return self._send_json({
                'success': True,
                'data': [{
                    'id': 'm_trial',
                    'tierCode': 'TS_TRIAL',
                    'capacityGhs': 1.0,
                    'status': 'ACTIVE',
                    'purchasedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ')
                }]
            })
        elif '/api/v1/treasury/metrics' in self.path:
            return self._send_json({
                'success': True,
                'data': {'totalStaked': 154000, 'rewardPool': 89200, 'activeMiners': 1420}
            })
        elif '/api/v1/user/trust/profile' in self.path:
            return self._send_json({
                'success': True,
                'data': {'trustScore': 98, 'tier': 'GOLD', 'verificationLevel': 'VERIFIED'}
            })
        elif '/api/v1/growth/progress' in self.path:
            return self._send_json({
                'success': True,
                'data': {
                    'level': {
                        'currentLevel': 'NEW',
                        'levelName': 'Titan Novice',
                        'benefits': ['Standard Hashrate', 'Basic Thermal Vauls'],
                        'upgradedAt': None,
                        'nextLevel': {
                            'level': 'VERIFIED',
                            'name': 'Titan Operator',
                            'minAccountAgeDays': 3,
                            'minSuccessfulSettlements': 1,
                            'minTrustScore': 50,
                            'benefits': ['Priority Mining Rate', 'Advanced Thermal Vauls']
                        },
                        'progressPercent': 35,
                        'criteria': [
                            {'key': 'trust', 'label': 'Trust Score', 'current': 35, 'required': 50, 'met': False},
                            {'key': 'settlements', 'label': 'Settlements', 'current': 0, 'required': 1, 'met': False}
                        ]
                    },
                    'streak': {'days': 1, 'best': 3},
                    'totals': {
                        'totalClaimed': 0,
                        'totalEarned': session.get('usdtBalance', 0.0),
                        'availableCount': 1,
                        'estimatedRemaining': 0.0
                    },
                    'recentAchievements': [],
                    'justUnlocked': [],
                    'nextBestAction': {
                        'type': 'COMPLETE_MISSION',
                        'title': 'Start Mining Operation',
                        'message': 'Keep your thermal cooling active to earn USDT yield.',
                        'tab': 'mine'
                    },
                    'upcomingUnlock': {
                        'missionId': 'm_unlock_1',
                        'name': 'Titan Operator Badge',
                        'amount': '1.00',
                        'assetCode': 'USDT',
                        'progressPercent': 35,
                        'requirement': None,
                        'estimatedRemaining': '15 Gh/s capacity',
                        'actionTab': 'mine'
                    }
                }
            })
        elif '/api/v1/settlement/history' in self.path:
            return self._send_json({'success': True, 'data': []})
        elif '/api/v1/financial/transactions' in self.path:
            return self._send_json({'success': True, 'data': []})
        elif '/api/v1/growth/referrals' in self.path:
            return self._send_json({
                'success': True,
                'data': {
                    'totalInvited': len(session.get('referrals', [])),
                    'totalEarnedUSDT': session.get('referralEarnedUsdt', 0.0),
                    'referralCode': f"TS{user_id[-6:]}",
                    'referralLink': f"/ref/TS{user_id[-6:]}",
                    'referredBy': session.get('referredBy', None),
                    'referrals': session.get('referrals', [])
                }
            })
        elif '/api/v1/growth/' in self.path:
            return self._send_json({'success': True, 'data': []})
        else:
            return self._send_json({'success': True, 'data': {'path': self.path}})

    def do_POST(self):
        user_id = self._get_user_id()
        session = get_user_session(user_id)

        content_length = int(self.headers.get('Content-Length', 0))
        body_bytes = self.rfile.read(content_length) if content_length > 0 else b'{}'
        try:
            body = json.loads(body_bytes.decode('utf-8'))
        except Exception:
            body = {}

        if '/api/v1/mining/claim' in self.path:
            unclaimed = session.get('unclaimedBalance', 0.0)
            if unclaimed < 3.0:
                return self._send_json({
                    'success': False,
                    'error': {
                        'code': 'MINIMUM_THRESHOLD_NOT_MET',
                        'message': f'Minimum collection threshold is $3.00 (Current balance: ${unclaimed:.4f}). Keep mining to reach $3.00!'
                    }
                }, status=400)
            
            session['usdtBalance'] = round(session.get('usdtBalance', 0.0) + unclaimed, 6)
            session['unclaimedBalance'] = 0.0
            session['lastUpdatedAt'] = time.time()
            save_dev_sessions(DEV_SESSIONS)
            return self._send_json({
                'success': True,
                'data': {
                    'claimedAmount': unclaimed,
                    'session': session
                }
            })
        elif '/api/v1/mining/tap' in self.path:
            tap_yield = session.get('tapYieldPerTap', 0.02)
            session['unclaimedBalance'] = round(session.get('unclaimedBalance', 0.0) + tap_yield, 6)
            session['lastUpdatedAt'] = time.time()
            save_dev_sessions(DEV_SESSIONS)
            return self._send_json({
                'success': True,
                'data': {
                    'tapYield': tap_yield,
                    'unclaimedBalance': session['unclaimedBalance']
                }
            })
        elif '/api/v1/growth/referrals/attach' in self.path:
            ref_code = body.get('referralCode', '')
            has_existing = session.get('isExistingAccount', False) or session.get('referredBy') is not None
            if has_existing:
                return self._send_json({
                    'success': True,
                    'data': {
                        'attached': False,
                        'isExistingUser': True,
                        'message': 'User is an existing operator. First-touch referral preservation active.'
                    }
                })
            
            if ref_code:
                session['referredBy'] = {
                    'referrerId': ref_code,
                    'name': f'Operator {ref_code}',
                    'joinedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'status': 'REGISTERED'
                }
                session['isExistingAccount'] = True
                save_dev_sessions(DEV_SESSIONS)
            return self._send_json({'success': True, 'data': {'attached': True, 'isExistingUser': False, 'referralCode': ref_code}})
        elif '/auth/telegram-login' in self.path or '/auth/telegram' in self.path:
            tg_id = str(body.get('id') or body.get('telegramUserId') or random.randint(1000000, 9999999))
            first_name = body.get('first_name') or body.get('firstName') or 'Operator'
            last_name = body.get('last_name') or body.get('lastName') or ''
            username = body.get('username') or f'op_{tg_id[:6]}'

            is_new_user = not session.get('isExistingAccount', False)

            ref_code = body.get('referralCode') or body.get('startParam')
            if ref_code and is_new_user and not session.get('referredBy'):
                session['referredBy'] = {
                    'referrerId': str(ref_code),
                    'name': f'Operator {ref_code}',
                    'joinedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'status': 'REGISTERED'
                }

            session['isExistingAccount'] = True
            save_dev_sessions(DEV_SESSIONS)

            user_payload = {
                'id': tg_id,
                'telegramUserId': int(tg_id) if tg_id.isdigit() else 1001,
                'firstName': first_name,
                'lastName': last_name,
                'username': username,
                'state': 'READY',
                'isReady': True,
                'role': 'USER'
            }

            return self._send_json({
                'success': True,
                'data': {
                    'accessToken': f'mock_access_token_{tg_id}',
                    'refreshToken': f'mock_refresh_token_{tg_id}',
                    'user': user_payload,
                    'onboarding': {'currentStep': 'welcome', 'isCompleted': True},
                    'isNewUser': is_new_user
                }
            })
        elif '/auth/telegram-nonce' in self.path:
            return self._send_json({
                'success': True,
                'data': {'nonce': f'nonce_{int(time.time())}_{random.randint(1000,9999)}', 'expiresAt': time.time() + 300}
            })
        elif '/auth/web-session/create' in self.path:
            session_code = f'sess_{int(time.time())}_{random.randint(1000,9999)}'
            return self._send_json({
                'success': True,
                'data': {
                    'sessionCode': session_code,
                    'deepLink': f'https://t.me/titanstream_bot?start={session_code}'
                }
            })
        elif '/auth/web-session/poll' in self.path:
            return self._send_json({
                'success': True,
                'data': {'status': 'PENDING'}
            })
        elif '/auth/whatsapp/request-otp' in self.path:
            phone = body.get('phone', '+256770000000')
            return self._send_json({
                'success': True,
                'message': 'If this number is eligible, a verification code will be sent.',
                'data': {'phone': phone}
            })
        elif '/auth/whatsapp/verify-otp' in self.path:
            phone = body.get('phone', '+256770000000')
            user_id = f'usr_{random.randint(100000, 999999)}'
            return self._send_json({
                'success': True,
                'data': {
                    'accessToken': f'mock_access_token_{user_id}',
                    'refreshToken': f'mock_refresh_token_{user_id}',
                    'user': {
                        'id': user_id,
                        'telegramUserId': None,
                        'phone': phone,
                        'state': 'READY',
                        'isReady': True
                    },
                    'onboarding': {'currentStep': 'welcome', 'isCompleted': True},
                    'isNewUser': True
                }
            })
        else:
            return self._send_json({'success': True, 'data': {'path': self.path, 'received': body}})

def run():
    server = HTTPServer(('0.0.0.0', PORT), TitanDevServer)
    print(f'TitanStream Python Local Server listening on http://0.0.0.0:{PORT}...')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()

if __name__ == '__main__':
    run()
