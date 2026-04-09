import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:vendorcenter/vendor_app.dart';
import 'package:vendorcenter/firebase_options.dart';
import 'package:vendorcenter/services/auth_service.dart';
import 'package:vendorcenter/services/theme_service.dart';
import 'package:vendorcenter/services/favorites_service.dart';
import 'package:vendorcenter/services/localization_service.dart';
import 'package:vendorcenter/screens/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

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

  // Activate App Check — Play Integrity suppresses reCAPTCHA redirect
  await FirebaseAppCheck.instance.activate(
    androidProvider: AndroidProvider.playIntegrity,
  );

  final prefs = await SharedPreferences.getInstance();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()..restoreSession()),
        ChangeNotifierProvider(create: (_) => ThemeService(prefs)),
        ChangeNotifierProvider(create: (_) => FavoritesService(prefs)),
        ChangeNotifierProvider(create: (_) => LocalizationService()),
      ],
      child: const _VendorAppEntry(),
    ),
  );
}

class _VendorAppEntry extends StatefulWidget {
  const _VendorAppEntry();
  @override
  State<_VendorAppEntry> createState() => _VendorAppEntryState();
}

class _VendorAppEntryState extends State<_VendorAppEntry> {
  bool _showSplash = true;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _showSplash = false);
    });
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
    return const VendorApp();
  }
}
