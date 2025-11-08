import secrets
from flask import Blueprint, jsonify, request
from models import db, Alias, User
from utils import generate_random_password

alias_bp = Blueprint("alias", __name__)

@alias_bp.route("/aliases", methods=["GET", "POST"])
def manage_aliases():
    if request.method == "POST":
        data = request.get_json()
        if not data or "user_id" not in data or "domain" not in data:
            return jsonify({"error": "user_id and domain are required"}), 400

        user = User.query.get(data["user_id"])
        if not user:
            return jsonify({"error": "Invalid user_id"}), 400

        domain = data["domain"].strip().lower()
        if "@" in domain:
            domain = domain.split("@")[-1]

        for _ in range(5):
            candidate = f"{secrets.token_hex(8)}@{domain}"
            if not Alias.query.filter_by(alias_email=candidate).first():
                break
        else:
            return jsonify({"error": "Unable to generate unique alias"}), 500

        alias = Alias(
            user_id=user.id,
            alias_email=candidate,
            generated_password=generate_random_password(),
            site_name=data.get("site_name"),
            group_name=data.get("group_name"),
        )
        db.session.add(alias)
        db.session.commit()

        return jsonify({
            "alias_id": alias.id,
            "alias_email": alias.alias_email,
            "generated_password": alias.generated_password
        }), 201

    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    aliases = Alias.query.filter_by(user_id=user_id).all()
    return jsonify([
        {
            "id": a.id,
            "alias_email": a.alias_email,
            "site_name": a.site_name,
            "group_name": a.group_name,
            "created_at": a.created_at.isoformat() if a.created_at else None
        } for a in aliases
    ])
