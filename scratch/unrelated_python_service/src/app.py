from flask import Flask, jsonify, request
app = Flask(__name__)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "payments-gateway"})

@app.route("/process", methods=["POST"])
def process():
    data = request.get_json() or {}
    if "amount" not in data:
        return jsonify({"error": "amount required"}), 400
    return jsonify({"status": "processed", "amount": data["amount"]})
