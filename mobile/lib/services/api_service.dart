import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:vendorcenter/config/api_config.dart';

class ApiService {
  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;

  late final Dio _dio;
  final _storage = const FlutterSecureStorage();

  static const _accessKey = 'vc_access_token';
  static const _refreshKey = 'vc_refresh_token';
  static const _userKey = 'vc_user';

  ApiService._() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: ApiConfig.timeout,
      receiveTimeout: ApiConfig.timeout,
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: _accessKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refreshed = await _refreshToken();
          if (refreshed) {
            // Retry with new token
            final token = await _storage.read(key: _accessKey);
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            final response = await _dio.fetch(error.requestOptions);
            return handler.resolve(response);
          }
        }
        handler.next(error);
      },
    ));
  }

  Dio get dio => _dio;

  // ─── Token management ──────────────────────────
  Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  Future<void> saveUser(String userJson) async {
    await _storage.write(key: _userKey, value: userJson);
  }

  Future<String?> getUser() => _storage.read(key: _userKey);

  Future<void> clearAll() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _userKey);
  }

  Future<bool> hasTokens() async {
    final token = await _storage.read(key: _accessKey);
    return token != null;
  }

  Future<bool> _refreshToken() async {
    try {
      final refresh = await _storage.read(key: _refreshKey);
      if (refresh == null) return false;

      final res = await Dio(BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        headers: {'Content-Type': 'application/json'},
      )).post('/auth/refresh', data: {'refreshToken': refresh});

      if (res.statusCode == 200 && res.data['success'] == true) {
        await saveTokens(
          res.data['data']['accessToken'],
          res.data['data']['refreshToken'],
        );
        return true;
      }
      await clearAll();
      return false;
    } catch (_) {
      await clearAll();
      return false;
    }
  }

  // ─── Auth endpoints ────────────────────────────
  Future<Map<String, dynamic>> login(String email, String password, {String? role}) async {
    final res = await _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
      if (role != null) 'role': role,
    });
    return res.data;
  }

  /// Check per-phone + platform daily OTP limit and user existence.
  /// Returns remaining count on success, throws on limit/error.
  Future<int> checkPhoneOtpGate(String phone, {String role = 'customer'}) async {
    final res = await _dio.post('/auth/phone-otp-gate', data: {'phone': phone, 'role': role});
    return res.data['remaining'] ?? 0;
  }

  Future<Map<String, dynamic>> phoneLogin(String idToken, {String role = 'customer'}) async {
    final res = await _dio.post('/auth/phone-login', data: {
      'idToken': idToken,
      'role': role,
    });
    return res.data;
  }

  Future<void> logout() async {
    final refresh = await _storage.read(key: _refreshKey);
    try {
      await _dio.post('/auth/logout', data: {'refreshToken': refresh});
    } catch (_) {}
    await clearAll();
  }

  // ─── Categories & Vendors ──────────────────────
  Future<List<dynamic>> getCategories({double? lat, double? lng, double? radius}) async {
    final params = <String, dynamic>{};
    if (lat != null) params['lat'] = lat;
    if (lng != null) params['lng'] = lng;
    if (radius != null) params['radius'] = radius;
    final res = await _dio.get('/vendors/categories', queryParameters: params);
    return res.data['data'] ?? [];
  }

  Future<List<dynamic>> getVendorsByCategory(String category, {double? lat, double? lng}) async {
    final params = <String, dynamic>{'category': category};
    if (lat != null) params['lat'] = lat;
    if (lng != null) params['lng'] = lng;
    final res = await _dio.get('/vendors/by-category', queryParameters: params);
    return res.data['data'] ?? [];
  }

  Future<List<dynamic>> getApprovedVendors({double? lat, double? lng}) async {
    final params = <String, dynamic>{};
    if (lat != null) params['lat'] = lat;
    if (lng != null) params['lng'] = lng;
    final res = await _dio.get('/vendors/approved', queryParameters: params);
    return res.data['data'] ?? [];
  }

  Future<Map<String, dynamic>> getVendorDetail(String vendorId) async {
    final res = await _dio.get('/vendors/detail/$vendorId');
    return res.data['data'] ?? {};
  }

  // ─── Services ──────────────────────────────────
  Future<List<dynamic>> getServices({String? vendorId}) async {
    final path = vendorId != null ? '/vendors/detail/$vendorId/services' : '/services';
    final res = await _dio.get(path);
    return res.data['data'] ?? [];
  }

  // ─── Bookings ──────────────────────────────────
  Future<List<dynamic>> getBookings() async {
    final res = await _dio.get('/bookings');
    return res.data['data'] ?? [];
  }

  Future<Map<String, dynamic>> createBooking({
    required String vendorId,
    required String serviceName,
    required String date,
    required String time,
    String? notes,
    String? addressId,
    String? pincode,
  }) async {
    final res = await _dio.post('/bookings', data: {
      'vendorId': vendorId,
      'serviceName': serviceName,
      'scheduledDate': date,
      'scheduledTime': time,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (addressId != null) 'addressId': addressId,
      if (pincode != null) 'pincode': pincode,
    });
    return res.data;
  }

  Future<Map<String, dynamic>> payBooking(String bookingId, String paymentToken) async {
    final res = await _dio.post('/bookings/$bookingId/pay', data: {
      'paymentToken': paymentToken,
    });
    return res.data;
  }

  // ─── Reviews ───────────────────────────────────
  Future<List<dynamic>> getPublicReviews([String? vendorId, int limit = 10]) async {
    final params = <String, dynamic>{'limit': limit};
    if (vendorId != null) params['vendorId'] = vendorId;
    final res = await _dio.get('/reviews/public', queryParameters: params);
    return res.data['data'] ?? [];
  }

  Future<Map<String, dynamic>> createReview(Map<String, dynamic> data) async {
    final res = await _dio.post('/reviews', data: data);
    return res.data;
  }

  // ─── Profile ───────────────────────────────────
  Future<Map<String, dynamic>> getProfile() async {
    final res = await _dio.get('/auth/profile');
    return res.data['data'] ?? {};
  }

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async {
    final res = await _dio.put('/auth/profile', data: data);
    return res.data['data'] ?? {};
  }

  // ─── Public stats ──────────────────────────────
  Future<Map<String, dynamic>> getPublicStats() async {
    final res = await _dio.get('/analytics/public');
    return res.data['data'] ?? {};
  }

  // ─── Vendor endpoints ──────────────────────────
  Future<Map<String, dynamic>> getVendorDashboard() async {
    final res = await _dio.get('/analytics/vendor');
    return res.data['data'] ?? {};
  }

  Future<List<dynamic>> getVendorBookings({String? status}) async {
    final res = await _dio.get('/bookings/');
    return res.data['data'] ?? [];
  }

  Future<Map<String, dynamic>> updateBookingStatus(String bookingId, String status, {String? amount, String? otp}) async {
    final data = <String, dynamic>{'status': status};
    if (amount != null) data['amount'] = amount;
    if (otp != null) data['completionOtp'] = otp;
    final res = await _dio.patch('/bookings/$bookingId/status', data: data);
    return res.data;
  }

  Future<Map<String, dynamic>> setFinalAmount(String bookingId, double amount) async {
    final res = await _dio.patch('/bookings/$bookingId/final-amount', data: {'amount': amount});
    return res.data;
  }

  Future<Map<String, dynamic>> requestPayment(String bookingId) async {
    final res = await _dio.post('/bookings/$bookingId/complete');
    return res.data;
  }

  Future<Map<String, dynamic>> verifyCompletionOtp(String bookingId, String code) async {
    final res = await _dio.post('/bookings/$bookingId/verify-completion', data: {'code': code});
    return res.data;
  }

  Future<Map<String, dynamic>> rejectBooking(String bookingId, String reason) async {
    final res = await _dio.post('/bookings/$bookingId/reject', data: {'reason': reason});
    return res.data;
  }

  Future<List<dynamic>> getVendorServices() async {
    final res = await _dio.get('/services/mine');
    return res.data['data'] ?? [];
  }

  Future<Map<String, dynamic>> addService(Map<String, dynamic> data) async {
    final res = await _dio.post('/services/', data: data);
    return res.data;
  }

  Future<Map<String, dynamic>> updateService(String serviceId, Map<String, dynamic> data) async {
    final res = await _dio.patch('/services/$serviceId', data: data);
    return res.data;
  }

  Future<void> deleteService(String serviceId) async {
    await _dio.delete('/services/$serviceId');
  }

  Future<Map<String, dynamic>> getVendorProfile() async {
    final res = await _dio.get('/vendors/me');
    return res.data['data'] ?? {};
  }

  Future<Map<String, dynamic>> submitVendorOnboarding(Map<String, dynamic> data) async {
    final res = await _dio.post('/vendors/onboarding', data: data);
    return res.data['data'] ?? {};
  }

  Future<Map<String, dynamic>> updateVendorProfile(Map<String, dynamic> data) async {
    final res = await _dio.patch('/vendors/me', data: data);
    return res.data['data'] ?? {};
  }

  // ─── Availability ──────────────────────────────

  Future<Map<String, dynamic>> getVendorAvailability() async {
    final res = await _dio.get('/vendors/me/availability');
    return res.data['data'] ?? {};
  }

  Future<List<dynamic>> setVendorAvailability(List<Map<String, dynamic>> slots) async {
    final res = await _dio.put('/vendors/me/availability', data: {'slots': slots});
    return res.data['data'] ?? [];
  }

  Future<Map<String, dynamic>> addBlockedDate(String date, {String? reason}) async {
    final res = await _dio.post('/vendors/me/blocked-dates', data: {'date': date, 'reason': reason});
    return res.data['data'] ?? {};
  }

  Future<void> removeBlockedDate(String date) async {
    await _dio.delete('/vendors/me/blocked-dates/$date');
  }

  Future<List<dynamic>> getAvailableSlots(String vendorId, String date) async {
    final res = await _dio.get('/vendors/$vendorId/available-slots', queryParameters: {'date': date});
    return res.data['data'] ?? [];
  }

  Future<Map<String, dynamic>> getVendorReviewStats() async {
    // Get vendor ID from profile first
    final profile = await getVendorProfile();
    final vendorId = profile['id'] ?? '';
    if (vendorId.toString().isEmpty) return {'totalReviews': 0, 'averageRating': '0'};
    final res = await _dio.get('/reviews/vendor/$vendorId/rating');
    return res.data['data'] ?? {};
  }

  // ─── AI Assistant ──────────────────────────────
  Future<List<String>> getAiSuggestions({String lang = 'en'}) async {
    final res = await _dio.get('/ai-assistant/suggestions', queryParameters: {'lang': lang});
    final data = res.data['data'];
    if (data is List) return List<String>.from(data.map((s) => s.toString()));
    return [];
  }

  Future<Map<String, dynamic>> queryAiAssistant({
    required String message,
    String lang = 'en',
    String? conversationId,
    double? lat,
    double? lng,
    String? currentPage,
  }) async {
    final res = await _dio.post('/ai-assistant/query', data: {
      'message': message,
      'lang': lang,
      if (conversationId != null) 'conversationId': conversationId,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (currentPage != null) 'currentPage': currentPage,
    });
    return res.data['data'] ?? {};
  }

  Future<void> clearAiConversation(String? conversationId) async {
    if (conversationId == null) return;
    await _dio.post('/ai-assistant/clear', data: {'conversationId': conversationId});
  }

  // ─── Notifications ─────────────────────────────
  Future<List<dynamic>> getNotifications() async {
    final res = await _dio.get('/notifications/my');
    return res.data['data'] ?? [];
  }

  // ─── Password reset ────────────────────────────
  Future<Map<String, dynamic>> requestPasswordReset(String email) async {
    final res = await _dio.post('/auth/forgot-password', data: {'email': email});
    return res.data;
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String otpId,
    required String code,
    required String newPassword,
  }) async {
    final res = await _dio.post('/auth/reset-password', data: {
      'email': email,
      'otpId': otpId,
      'code': code,
      'newPassword': newPassword,
    });
    return res.data;
  }

  // ─── Signup ────────────────────────────────────
  Future<Map<String, dynamic>> signup({
    required String name,
    required String email,
    required String password,
    required String phone,
    String role = 'customer',
    String? businessName,
  }) async {
    final data = <String, dynamic>{
      'name': name,
      'email': email,
      'password': password,
      'phone': phone,
      'role': role,
    };
    if (businessName != null && businessName.isNotEmpty) {
      data['businessName'] = businessName;
    }
    final res = await _dio.post('/auth/signup', data: data);
    return res.data;
  }

  // ─── OTP ───────────────────────────────────────
  Future<Map<String, dynamic>> requestOtp({
    required String identifier,
    required String purpose,
  }) async {
    final res = await _dio.post('/otp/request', data: {
      'email': identifier,
      'purpose': purpose,
    });
    return res.data;
  }

  Future<Map<String, dynamic>> verifyOtp({
    required String identifier,
    required String code,
    required String purpose,
  }) async {
    // Backend expects otpId, but we may not have it; use email-based lookup
    final res = await _dio.post('/otp/verify', data: {
      'otpId': identifier,
      'code': code,
      'purpose': purpose,
    });
    return res.data;
  }

  // ─── Location & Explore ────────────────────────
  Future<List<dynamic>> getNearbyVendors({
    required double lat,
    required double lng,
    double radius = 10,
    String? category,
  }) async {
    final params = <String, dynamic>{
      'lat': lat,
      'lng': lng,
      'radiusKm': radius,
    };
    if (category != null) params['category'] = category;
    final res = await _dio.get('/location/vendors-nearby', queryParameters: params);
    return res.data['data'] ?? [];
  }

  Future<List<dynamic>> getTopCategoriesNearby({
    required double lat,
    required double lng,
  }) async {
    final res = await _dio.get('/location/top-categories', queryParameters: {
      'lat': lat,
      'lng': lng,
    });
    return res.data['data'] ?? [];
  }

  Future<Map<String, dynamic>> checkZone({
    required double lat,
    required double lng,
  }) async {
    final res = await _dio.get('/location/zone-check', queryParameters: {
      'lat': lat,
      'lng': lng,
    });
    return res.data['data'] ?? {};
  }

  Future<List<dynamic>> getMapVendors({
    required double lat,
    required double lng,
    double radius = 10,
  }) async {
    final res = await _dio.get('/maps/nearby-vendors', queryParameters: {
      'lat': lat,
      'lng': lng,
      'radius': radius,
    });
    return res.data['data'] ?? [];
  }

  // ─── File Upload ───────────────────────────────
  Future<String> uploadFile(String filePath) async {
    final fileName = filePath.split(RegExp(r'[/\\]')).last;
    // Ensure proper extension — image_picker temp files may lose it
    final ext = fileName.contains('.') ? fileName.split('.').last.toLowerCase() : 'jpg';
    final safeName = fileName.contains('.') ? fileName : '$fileName.$ext';
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        filePath,
        filename: safeName,
        contentType: DioMediaType('image', ext == 'png' ? 'png' : ext == 'webp' ? 'webp' : 'jpeg'),
      ),
    });
    final res = await _dio.post(
      '/uploads/file',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    return res.data['data']?['url'] ?? '';
  }

  Future<Map<String, dynamic>> updateProfilePhoto(String photoUrl) async {
    final res = await _dio.put('/auth/profile', data: {'profilePictureUrl': photoUrl});
    return res.data['data'] ?? {};
  }

  // ─── Paginated Vendors ─────────────────────────
  Future<List<dynamic>> getApprovedVendorsPaginated({
    double? lat, double? lng,
    int page = 1, int limit = 10,
  }) async {
    final params = <String, dynamic>{'page': page, 'limit': limit};
    if (lat != null) params['lat'] = lat;
    if (lng != null) params['lng'] = lng;
    final res = await _dio.get('/vendors/approved', queryParameters: params);
    return res.data['data'] ?? [];
  }

  // ─── Customer Addresses ────────────────────────
  Future<List<dynamic>> getAddresses() async {
    final res = await _dio.get('/addresses');
    return res.data['data'] ?? [];
  }

  Future<Map<String, dynamic>> getAddress(String id) async {
    final res = await _dio.get('/addresses/$id');
    return res.data['data'] ?? {};
  }

  Future<Map<String, dynamic>> createAddress(Map<String, dynamic> data) async {
    final res = await _dio.post('/addresses', data: data);
    return res.data['data'] ?? {};
  }

  Future<Map<String, dynamic>> updateAddress(String id, Map<String, dynamic> data) async {
    final res = await _dio.patch('/addresses/$id', data: data);
    return res.data['data'] ?? {};
  }

  Future<void> deleteAddress(String id) async {
    await _dio.delete('/addresses/$id');
  }

  Future<void> setDefaultAddress(String id) async {
    await _dio.patch('/addresses/$id/default');
  }

  // ─── Service Zones & Serviceability ────────────
  Future<Map<String, dynamic>> checkServiceability(String pincode) async {
    final res = await _dio.get('/service-zones/check', queryParameters: {'pincode': pincode});
    return res.data['data'] ?? {};
  }

  Future<Map<String, dynamic>> lookupPincode(String pincode) async {
    final res = await _dio.get('/service-zones/lookup-pincode/$pincode');
    return res.data['data'] ?? {};
  }
}
