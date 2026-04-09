import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:vendorcenter/services/api_service.dart';

class AuthService extends ChangeNotifier {
  final _api = ApiService();

  Map<String, dynamic>? _user;
  bool _loading = true;

  Map<String, dynamic>? get user => _user;
  bool get isLoggedIn => _user != null;
  bool get loading => _loading;
  String get userName => _user?['name'] ?? 'User';
  String? get userEmail => _user?['email'];
  String? get userPhone => _user?['phone'];
  String get userId => _user?['id'] ?? '';

  /// Restore session from secure storage on app start
  Future<void> restoreSession() async {
    try {
      final stored = await _api.getUser();
      if (stored != null) {
        _user = jsonDecode(stored);
      }
    } catch (_) {}
    _loading = false;
    notifyListeners();
  }

  /// Email + password login
  Future<void> login(String email, String password, {String role = 'customer'}) async {
    final res = await _api.login(email, password, role: role);
    if (res['success'] == true && res['data'] != null) {
      final data = res['data'];
      await _api.saveTokens(data['accessToken'], data['refreshToken']);
      await _api.saveUser(jsonEncode(data['actor']));
      _user = data['actor'];
      notifyListeners();
    } else {
      throw Exception(res['error'] ?? 'Login failed');
    }
  }

  /// Firebase phone login — receives idToken from Firebase Auth
  Future<void> phoneLogin(String idToken, {String role = 'customer'}) async {
    final res = await _api.phoneLogin(idToken, role: role);
    if (res['success'] == true && res['data'] != null) {
      final data = res['data'];
      await _api.saveTokens(data['accessToken'], data['refreshToken']);
      await _api.saveUser(jsonEncode(data['actor']));
      _user = data['actor'];
      notifyListeners();
    } else {
      throw Exception(res['error'] ?? 'Phone login failed');
    }
  }

  /// Logout
  Future<void> logout() async {
    await _api.logout();
    _user = null;
    notifyListeners();
  }

  /// Update local user data
  void updateUser(Map<String, dynamic> partial) {
    if (_user != null) {
      _user = {..._user!, ...partial};
      _api.saveUser(jsonEncode(_user));
      notifyListeners();
    }
  }
}
