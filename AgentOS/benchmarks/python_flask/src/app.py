# Seeded defect: missing dictionary .get() on optional key
def handle_checkout(data):
    user_id = data.get("user_id")
    amount = data.get("amount", 0)
    return {"status": "ok", "user": user_id, "amount": amount}
