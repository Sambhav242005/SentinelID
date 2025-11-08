from flask import Blueprint, jsonify, request
from models import db, Session, SessionTab

session_bp = Blueprint("session", __name__)


@session_bp.route("/sessions/start", methods=["POST"])
def start_session():
    data = request.get_json()
    if not data or "user_id" not in data:
        return jsonify({"error": "user_id is required"}), 400

    new_session = Session(user_id=data["user_id"])
    db.session.add(new_session)
    db.session.commit()
    return jsonify({"session_id": new_session.id}), 201


@session_bp.route("/sessions/<int:session_id>/tabs", methods=["POST"])
def add_tab(session_id):
    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"error": "url is required"}), 400

    new_tab = SessionTab(
        session_id=session_id,
        url=data["url"],
        cookies=data.get("cookies"),
        local_storage=data.get("local_storage"),
    )
    db.session.add(new_tab)
    db.session.commit()
    return jsonify({"tab_id": new_tab.id}), 201


@session_bp.route("/sessions/<int:session_id>/destroy", methods=["DELETE"])
def destroy_session(session_id):
    session = Session.query.get_or_404(session_id)
    session.active = False
    SessionTab.query.filter_by(session_id=session_id).delete()
    db.session.commit()
    return jsonify({"message": "Session destroyed"}), 200
