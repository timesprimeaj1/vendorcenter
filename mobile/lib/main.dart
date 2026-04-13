import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform, FlutterError, kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/app.dart';
import 'package:vendorcenter/firebase_options.dart';
import 'package:vendorcenter/services/auth_service.dart';
import 'package:vendorcenter/services/theme_service.dart';
import 'package:vendorcenter/services/favorites_service.dart';
import 'package:vendorcenter/services/notification_service.dart';
import 'package:vendorcenter/services/localization_service.dart';
import 'package:vendorcenter/services/location_service.dart';
import 'package:vendorcenter/screens/onboarding/onboarding_screen.dart';
import 'package:vendorcenter/screens/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock to portrait for consistent UX
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Set status bar style
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));

  // On Android, google-services.json per flavor is authoritative
  if (defaultTargetPlatform == TargetPlatform.android) {
    await Firebase.initializeApp();
  } else {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  }

  // App Check — DISABLED for sideloaded APKs.
  // Play Integrity requires Play Store install; blocking App Check prevents
  // phone auth reCAPTCHA fallback. Re-enable when published to Play Store.
  // await FirebaseAppCheck.instance.activate(
  //   androidProvider: kDebugMode ? AndroidProvider.debug : AndroidProvider.playIntegrity,
  // );

  // Firebase Crashlytics — disable in debug, enable in release
  await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(!kDebugMode);

  // Firebase Analytics
  final analytics = FirebaseAnalytics.instance;
  await analytics.setAnalyticsCollectionEnabled(!kDebugMode);
  await analytics.logAppOpen();

  final prefs = await SharedPreferences.getInstance();
  final seenOnboarding = prefs.getBool('onboarding_seen') ?? false;

  // Initialize push notifications
  await NotificationService().init();

  // Report install/update to backend (non-blocking)
  _reportInstall(prefs);

  // Global error handler — forward to Crashlytics
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    FirebaseCrashlytics.instance.recordFlutterFatalError(details);
  };

  // Catch async errors not handled by Flutter framework
  runZonedGuarded(() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()..restoreSession()),
        ChangeNotifierProvider(create: (_) => ThemeService(prefs)),
        ChangeNotifierProvider(create: (_) => FavoritesService(prefs)),
        ChangeNotifierProvider(create: (_) => LocalizationService()),
        ChangeNotifierProvider(create: (_) => LocationService()),
      ],
      child: _AppEntry(showOnboarding: !seenOnboarding, prefs: prefs),
    ),
  );
  }, (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
  });
}

/// Reports app install/update to backend analytics (fire-and-forget)
void _reportInstall(SharedPreferences prefs) async {
  try {
    // Generate or reuse a persistent device ID
    var deviceId = prefs.getString('vc_device_id');
    if (deviceId == null) {
      deviceId = DateTime.now().microsecondsSinceEpoch.toRadixString(36) +
          UniqueKey().toString();
      await prefs.setString('vc_device_id', deviceId);
    }
    final info = await PackageInfo.fromPlatform();
    await ApiService().reportInstall(
      deviceId: deviceId,
      appVersion: info.version,
      flavor: 'customer',
      deviceModel: Platform.localHostname,
      osVersion: Platform.operatingSystemVersion,
    );
  } catch (_) {
    // Non-critical — silently ignore
  }
}

class _AppEntry extends StatefulWidget {
  final bool showOnboarding;
  final SharedPreferences prefs;
  const _AppEntry({required this.showOnboarding, required this.prefs});

  @override
  State<_AppEntry> createState() => _AppEntryState();
}

class _AppEntryState extends State<_AppEntry> {
  late bool _showOnboarding;
  bool _showSplash = true;

  @override
  void initState() {
    super.initState();
    _showOnboarding = widget.showOnboarding;
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _showSplash = false);
    });
  }

  void _onOnboardingComplete() {
    widget.prefs.setBool('onboarding_seen', true);
    setState(() => _showOnboarding = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_showSplash) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData(scaffoldBackgroundColor: const Color(0xFF2563EB)),
        home: const SplashScreen(),
      );
    }
    if (_showOnboarding) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: OnboardingScreen(onComplete: _onOnboardingComplete),
      );
    }
    return const VendorCenterApp();
  }
}
