import urllib.request, json, time, hmac, hashlib, base64, sys

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def get_auth_token(user_id='18257320599'):
    header = b64url(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode('utf-8'))
    payload = b64url(json.dumps({
        'sub': user_id,
        'telegramUserId': user_id,
        'iat': int(time.time()),
        'exp': int(time.time()) + 3600
    }).encode('utf-8'))
    sig = hmac.new(b'dev-jwt-secret', f'{header}.{payload}'.encode('utf-8'), hashlib.sha256).digest()
    return f'{header}.{payload}.{b64url(sig)}'

def api_post(endpoint, body, token=None):
    url = f'http://localhost:3001{endpoint}'
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f'HTTP ERROR {e.code}: {err_body}')
        return e.code, json.loads(err_body)

def api_get(endpoint, token=None):
    url = f'http://localhost:3001{endpoint}'
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f'HTTP ERROR {e.code}: {err_body}')
        return e.code, json.loads(err_body)

def run_tests():
    test_user_id = f'1825{int(time.time()) % 1000000000:09d}'
    token = get_auth_token(test_user_id)
    print('===========================================================')
    print(f'TITAN STREAM — MERCHANT MOBILE MONEY RAIL E2E TEST SUITE (User: {test_user_id})')
    print('===========================================================')

    # Test 1: Create MTN Mobile Money Session
    print('\n[TEST 1] Creating MTN Mobile Money deposit session...')
    status, res1 = api_post('/api/v1/settlement/session', {
        'paymentMethod': 'MOBILE_MONEY',
        'mobileMoneyNetwork': 'MTN',
        'requestedAmount': '10',
        'expectedCryptoAmount': '10',
        'asset': 'USDT',
        'country': 'UG',
    }, token)
    assert status == 201 or status == 200
    s1 = res1.get('data') or res1
    print('  Status:', status)
    print('  Settlement ID:', s1['settlementId'])
    print('  Assigned Merchant:', s1.get('merchantName'), '(', s1.get('merchantNumber'), ')')
    print('  Requested Amount:', s1.get('requestedAmount'), 'UGX')
    assert s1.get('merchantNumber') == '234654'

    # Test 2: Create Airtel Mobile Money Session
    print('\n[TEST 2] Creating Airtel Mobile Money deposit session...')
    status, res2 = api_post('/api/v1/settlement/session', {
        'paymentMethod': 'MOBILE_MONEY',
        'mobileMoneyNetwork': 'AIRTEL',
        'requestedAmount': '15',
        'expectedCryptoAmount': '15',
        'asset': 'USDT',
        'country': 'UG',
    }, token)
    assert status == 201 or status == 200
    s2 = res2.get('data') or res2
    print('  Status:', status)
    print('  Settlement ID:', s2['settlementId'])
    print('  Assigned Merchant:', s2.get('merchantName'), '(', s2.get('merchantNumber'), ')')
    assert s2.get('merchantNumber') == '7183443'

    # Test 3: Customer Reference Submission -> AWAITING_VERIFICATION
    ref_code = f'CM_TEST_{int(time.time())}'
    print(f'\n[TEST 3] Submitting reference "{ref_code}" for settlement {s1["settlementId"]}...')
    status, res3 = api_post(f'/api/v1/settlement/session/{s1["settlementId"]}/submit-reference', {
        'reference': ref_code
    }, token)
    assert status == 200 or status == 201
    claim_res = res3.get('data') or res3
    if 'data' in claim_res and isinstance(claim_res['data'], dict):
        claim_res = claim_res['data']
    print('  res3:', res3)
    print('  Submission Status:', claim_res.get('status'))
    print('  Failure Reason:', claim_res.get('failureReason'))
    assert claim_res.get('status') == 'AWAITING_VERIFICATION'

    # Test 4: Ingest Authoritative MerchantTransaction -> Auto-Matching & Completion
    print(f'\n[TEST 4] Ingesting authoritative MerchantTransaction for ref "{ref_code}"...')
    status, res4 = api_post('/api/v1/admin/merchant-settlements/transactions/ingest', {
        'merchantId': s1['merchantId'],
        'network': 'MTN',
        'transactionReference': ref_code,
        'amount': float(s1['requestedAmount']),
        'currency': 'UGX',
        'senderPhone': '0779998877',
        'recipientMerchant': 'TitanStream Escrow MTN',
    }, token)
    assert status == 200 or status == 201
    print('  Ingest Success:', res4.get('success'))

    # Verify settlement completed
    time.sleep(1)
    status, s1_updated = api_get(f'/api/v1/settlement/session/{s1["settlementId"]}', token)
    print('  s1_updated response:', s1_updated)
    s1_data = s1_updated.get('data') or s1_updated
    print('  Settlement Final Status:', s1_data.get('status'))
    assert s1_data.get('status') == 'COMPLETED'
    print('  ✅ Auto-matching & Financial Orchestrator completion successful!')

    # Test 5: Re-consumption / Reference Reuse Prevention
    print('\n[TEST 5] Testing reference re-consumption prevention...')
    t5_user = f'1825{int(time.time() * 1000) % 1000000000:09d}'
    token5 = get_auth_token(t5_user)
    status, res5 = api_post('/api/v1/settlement/session', {
        'paymentMethod': 'MOBILE_MONEY',
        'mobileMoneyNetwork': 'MTN',
        'requestedAmount': '10',
        'expectedCryptoAmount': '10',
        'asset': 'USDT',
        'country': 'UG',
    }, token5)
    s5 = res5.get('data') or res5
    status, claim5 = api_post(f'/api/v1/settlement/session/{s5["settlementId"]}/submit-reference', {
        'reference': ref_code
    }, token5)
    c5_data = claim5.get('data') or claim5
    if isinstance(c5_data, dict) and 'data' in c5_data and isinstance(c5_data['data'], dict):
        c5_data = c5_data['data']
    print('  Claim Status:', c5_data.get('status'))
    print('  Failure Reason:', c5_data.get('failureReason'))
    assert c5_data.get('failureReason') == 'TRANSACTION_ALREADY_CONSUMED'
    print('  ✅ Re-consumption safely rejected with TRANSACTION_ALREADY_CONSUMED!')

    # Test 6: Amount Mismatch Rejection
    t6_user = f'1825{(int(time.time() * 1000) + 1) % 1000000000:09d}'
    token6 = get_auth_token(t6_user)
    ref_mismatch = f'CM_MISMATCH_{int(time.time())}'
    print('\n[TEST 6] Testing amount mismatch rejection...')
    status, res6 = api_post('/api/v1/settlement/session', {
        'paymentMethod': 'MOBILE_MONEY',
        'mobileMoneyNetwork': 'MTN',
        'requestedAmount': '10',
        'expectedCryptoAmount': '10',
        'asset': 'USDT',
        'country': 'UG',
    }, token6)
    s6 = res6.get('data') or res6
    
    # Ingest tx with wrong amount (e.g. 5000 UGX instead of ~37746 UGX)
    api_post('/api/v1/admin/merchant-settlements/transactions/ingest', {
        'merchantId': s6['merchantId'],
        'network': 'MTN',
        'transactionReference': ref_mismatch,
        'amount': 5000,
        'currency': 'UGX',
    }, token6)
    
    status, claim6 = api_post(f'/api/v1/settlement/session/{s6["settlementId"]}/submit-reference', {
        'reference': ref_mismatch
    }, token6)
    c6_data = claim6.get('data') or claim6
    if isinstance(c6_data, dict) and 'data' in c6_data and isinstance(c6_data['data'], dict):
        c6_data = c6_data['data']
    print('  Claim Status:', c6_data.get('status'))
    print('  Failure Reason:', c6_data.get('failureReason'))
    assert c6_data.get('failureReason') == 'AMOUNT_MISMATCH'
    print('  ✅ Mismatch safely rejected with AMOUNT_MISMATCH!')

    # Test 7: Admin Pending Verification Queue & Manual Verify & Settle
    print('\n[TEST 7] Testing Admin Pending Verification Queue & Manual Settle...')
    status, pending_res = api_get('/api/v1/admin/merchant-settlements/pending', token)
    pending_list = pending_res
    while isinstance(pending_list, dict) and 'data' in pending_list:
        pending_list = pending_list['data']
    print('  Pending Queue Items Count:', len(pending_list))
    assert len(pending_list) >= 1
    pending_item = pending_list[0]
    print('  Top Pending Item Claim ID:', pending_item['claimId'])

    status, admin_settle = api_post(f'/api/v1/admin/merchant-settlements/claims/{pending_item["claimId"]}/verify-and-settle', {
        'adminUserId': 'admin_test_1'
    }, token)
    admin_data = admin_settle.get('data') or admin_settle
    print('  Admin Settle Success:', admin_settle.get('success'))
    print('  Admin Settle Matched:', admin_data.get('matched'))
    assert admin_settle.get('success') is True

    # Test 8: Protected Card / Pesapal Isolation Verification
    t8_user = f'1825{(int(time.time() * 1000) + 2) % 1000000000:09d}'
    token8 = get_auth_token(t8_user)
    print('\n[TEST 8] PROTECTED PESAPAL / CARD SUBSYSTEM ISOLATION TEST...')
    status, card_res = api_post('/api/v1/settlement/session', {
        'paymentMethod': 'CARD',
        'requestedAmount': '25',
        'expectedCryptoAmount': '25',
        'asset': 'USDT',
        'country': 'UG',
        'phoneNumber': '0772772772'
    }, token8)
    card_data = card_res.get('data') or card_res
    print('  HTTP Status:', status)
    print('  Card Provider Pay URL:', card_data.get('payUrl'))
    print('  Order Tracking ID:', card_data.get('orderTrackingId'))
    print('  Card Session Status:', card_data.get('status'))
    assert status == 201 or status == 200
    assert 'pesapaliframe' in card_data.get('payUrl', '')
    assert card_data.get('status') == 'WAITING_FOR_PAYMENT'
    print('  ✅ PESAPAL / CARD SUBSYSTEM IS 100% UNTOUCHED AND OPERATIONAL!')

    print('\n===========================================================')
    print('ALL 8 TITAN STREAM MERCHANT MM E2E TESTS PASSED SUCCESSFULLY! ✅')
    print('===========================================================')

if __name__ == '__main__':
    run_tests()
