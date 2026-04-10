import 'dart:io' show Platform;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:vendorcenter/services/api_service.dart';

/// Android notification channel for booking-related push notifications.
const _bookingChannel = AndroidNotificationChannel(
  'vendorcenter_bookings',
  'Booking Notifications',
  description: 'Notifications for new bookings, status updates, and cancellations',
  importance: Importance.high,
  playSound: true,
  enableVibration: true,
);

/// Handles FCM push notifications — token retrieval, foreground/background handling.
class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final _messaging = FirebaseMessaging.instance;
  final _api = ApiService();
  final _localNotifications = FlutterLocalNotificationsPlugin();
  String? _token;
  String? get token => _token;

  /// Call once after Firebase.initializeApp()
  Future<void> init() async {
    // Request permission (iOS required, Android 13+ required)
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[FCM] Permission denied');
      return;
    }

    // Initialize local notifications for foreground display
    await _initLocalNotifications();

    // Get FCM token
    _token = await _messaging.getToken();
    debugPrint('[FCM] Token: $_token');

    // Listen for token refresh
    _messaging.onTokenRefresh.listen((newToken) {
      _token = newToken;
      debugPrint('[FCM] Token refreshed');
      registerTokenWithBackend();
    });

    // Foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // When app is opened from a notification (background → foreground)
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Check if app launched from a notification (terminated → foreground)
    final initial = await _messaging.getInitialMessage();
    if (initial != null) {
      _handleNotificationTap(initial);
    }
  }

  /// Set up local notification channels and initialize the plugin.
  Future<void> _initLocalNotifications() async {
    // Create the Android notification channel
    final androidPlugin = _localNotifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(_bookingChannel);

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    await _localNotifications.initialize(
      settings: const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: (details) {
        debugPrint('[Notification] Tapped local: ${details.payload}');
      },
    );
  }

  /// Register current FCM token with backend. Call after login.
  Future<void> registerTokenWithBackend() async {
    if (_token == null) return;
    try {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _api.registerDeviceToken(_token!, platform);
      debugPrint('[FCM] Token registered with backend');
    } catch (e) {
      debugPrint('[FCM] Failed to register token: $e');
    }
  }

  /// Remove token from backend. Call before logout.
  Future<void> unregisterTokenFromBackend() async {
    if (_token == null) return;
    try {
      await _api.removeDeviceToken(_token!);
      debugPrint('[FCM] Token unregistered from backend');
    } catch (e) {
      debugPrint('[FCM] Failed to unregister token: $e');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('[FCM] Foreground: ${message.notification?.title}');

    final notification = message.notification;
    if (notification == null) return;

    final android = AndroidNotificationDetails(
      _bookingChannel.id,
      _bookingChannel.name,
      channelDescription: _bookingChannel.description,
      importance: Importance.high,
      priority: Priority.high,
      icon: '@drawable/ic_notification',
      color: const Color(0xFFF97316), // VendorCenter orange
      styleInformation: BigTextStyleInformation(
        notification.body ?? '',
        contentTitle: notification.title,
      ),
    );

    const ios = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    _localNotifications.show(
      id: notification.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: NotificationDetails(android: android, iOS: ios),
      payload: message.data['bookingId'],
    );
  }

  void _handleNotificationTap(RemoteMessage message) {
    debugPrint('[FCM] Tapped: ${message.data}');
    // In future: navigate to relevant screen based on message.data
  }
}
