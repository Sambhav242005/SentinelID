from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash
from models import db, User

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data or not all(k in data for k in ("username", "email", "password")):
        return jsonify({"error": "username, email, and password are required"}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "User with this email already exists"}), 400

    pw_hash = generate_password_hash(data["password"], method="pbkdf2:sha256", salt_length=16)
    user = User(username=data["username"], email=data["email"], password_hash=pw_hash)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "User registered!", "user_id": user.id}), 201
