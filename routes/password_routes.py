from flask import Blueprint, jsonify, request
from models import PasswordBreachResponse,PasswordStatus
from utils import check_hibp_api

password_bp = Blueprint("password", __name__)

@password_bp.route("/check-password", methods=["POST"])
def check_password_pwned():
    try:
        data = request.get_json(silent=True)
        if not data or "password" not in data:
            return jsonify({"error": "Password is required"}), 400

        password = data["password"].strip()
        if not password:
            return jsonify({"error": "Password cannot be empty"}), 400

        is_pwned, count = check_hibp_api(password)
        if is_pwned:
            response = PasswordBreachResponse(
                status=PasswordStatus.PWNED,
                message="This password has been exposed in data breaches.",
                count=count
            )
        else:
            response = PasswordBreachResponse(
                status=PasswordStatus.SAFE,
                message="This password was not found in the HIBP database.",
                count=0
            )
        return jsonify(response.dict()), 200
    except Exception as e:
        print(f"[ERROR] check_password_pwned: {e}")
        return jsonify({"status": "ERROR", "message": str(e)}), 500
