import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/auth_service.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/services/localization_service.dart';

enum AuthStep { method, phoneInput, phoneOtp, emailLogin }

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  AuthStep _step = AuthStep.method;
  final _phoneCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  bool _loading = false;
  String? _error;
  int _countdown = 0;
  Timer? _timer;

  String? _verificationId;
  int? _resendToken;

  late AnimationController _slideCtrl;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _slideCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0.15, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOutCubic));
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _slideCtrl.dispose();
    _timer?.cancel();
    super.dispose();
  }

  void _goToStep(AuthStep step) {
    setState(() { _step = step; _error = null; });
    _slideCtrl.forward(from: 0);
  }

  void _startCountdown() {
    _countdown = 30;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_countdown <= 1) { t.cancel(); }
      setState(() => _countdown--);
    });
  }

  // ─── Send SMS OTP via Firebase ─────────────────
  Future<void> _sendOtp() async {
    final phone = _phoneCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (phone.length != 10) {
      setState(() => _error = 'Enter a valid 10-digit number');
      return;
    }

    setState(() { _loading = true; _error = null; });

    // Platform-wide daily OTP gate — blocks if 9/day limit reached
    try {
      await ApiService().checkPhoneOtpGate(phone);
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = (e is DioException && e.response?.statusCode == 429)
              ? 'Daily SMS limit reached. Please try again tomorrow.'
              : (e is DioException && e.response?.statusCode == 503)
                  ? 'OTP service temporarily unavailable. Try again shortly.'
                  : 'Unable to verify OTP availability. Try again.';
        });
      }
      return;
    }

    await FirebaseAuth.instance.verifyPhoneNumber(
      phoneNumber: '+91$phone',
      forceResendingToken: _resendToken,
      verificationCompleted: (PhoneAuthCredential credential) async {
        // Auto-verify on some devices
        await _signInWithCredential(credential);
      },
      verificationFailed: (FirebaseAuthException e) {
        setState(() {
          _loading = false;
          if (e.code == 'too-many-requests') {
            _error = 'Too many attempts. Try again later.';
          } else if (e.code == 'invalid-phone-number') {
            _error = 'Invalid phone number.';
          } else {
            _error = e.message ?? 'Verification failed';
          }
        });
      },
      codeSent: (String verificationId, int? resendToken) {
        _verificationId = verificationId;
        _resendToken = resendToken;
        setState(() => _loading = false);
        _goToStep(AuthStep.phoneOtp);
        _startCountdown();
      },
      codeAutoRetrievalTimeout: (String verificationId) {
        _verificationId = verificationId;
      },
    );
  }

  // ─── Verify OTP ────────────────────────────────
  Future<void> _verifyOtp() async {
    final code = _otpCtrl.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit code');
      return;
    }
    if (_verificationId == null) {
      setState(() => _error = 'Session expired. Please resend OTP.');
      return;
    }

    setState(() { _loading = true; _error = null; });

    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: code,
      );
      await _signInWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      setState(() {
        _loading = false;
        _error = e.code == 'invalid-verification-code'
            ? 'Invalid OTP. Try again.'
            : (e.message ?? 'Verification failed');
      });
    }
  }

  Future<void> _signInWithCredential(PhoneAuthCredential credential) async {
    try {
      final userCred = await FirebaseAuth.instance.signInWithCredential(credential);
      final idToken = await userCred.user?.getIdToken();
      if (idToken == null) throw Exception('No token');

      if (!mounted) return;
      await context.read<AuthService>().phoneLogin(idToken);
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _friendlyError(e);
        });
      }
    }
  }

  // ─── Email login ───────────────────────────────
  Future<void> _emailLogin() async {
    if (_emailCtrl.text.isEmpty || _passwordCtrl.text.isEmpty) {
      setState(() => _error = 'Enter email and password');
      return;
    }

    setState(() { _loading = true; _error = null; });

    try {
      await context.read<AuthService>().login(_emailCtrl.text.trim(), _passwordCtrl.text);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = _friendlyError(e);
      });
    }
  }

  String _friendlyError(Object e) {
    final s = e.toString().toLowerCase();
    // Network errors first
    if (s.contains('network') || s.contains('connection') || s.contains('socketexception')) {
      return 'Network error. Please check your internet connection.';
    }
    if (s.contains('suspended')) {
      return 'Your account has been suspended. Contact support.';
    }
    // Phone OTP specific errors
    if (s.contains('invalid-verification-code') || s.contains('invalid verification')) {
      return 'Invalid OTP code. Please try again.';
    }
    if (s.contains('expired') || s.contains('session-expired')) {
      return 'Verification expired. Please resend OTP.';
    }
    if (s.contains('409') || s.contains('already exists')) {
      return 'Account already exists. Try logging in.';
    }
    // Backend: "This account uses phone login" — for email-login attempt on phone-only account
    if (s.contains('uses phone login')) {
      return 'This account uses phone login. Please use OTP instead.';
    }
    if (s.contains('401') || s.contains('invalid credentials') || s.contains('unauthorized')) {
      return 'Incorrect email or password. Please try again.';
    }
    if (s.contains('404') || s.contains('not found')) {
      return 'Account not found. Please check your details.';
    }
    if (s.contains('500') || s.contains('phone login failed') || s.contains('server error')) {
      return 'Server error. Please try again later.';
    }
    return 'Login failed. Please try again.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
            child: _buildStep(),
          ),
        ),
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case AuthStep.method:
        return _buildMethodSelection();
      case AuthStep.phoneInput:
        return SlideTransition(position: _slideAnim, child: _buildPhoneInput());
      case AuthStep.phoneOtp:
        return SlideTransition(position: _slideAnim, child: _buildPhoneOtp());
      case AuthStep.emailLogin:
        return SlideTransition(position: _slideAnim, child: _buildEmailLogin());
    }
  }

  // ─── Method selection ──────────────────────────
  Widget _buildMethodSelection() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Logo
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.gradientStart, AppColors.gradientEnd],
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Icon(Icons.storefront, size: 40, color: Colors.white),
        ),
        const SizedBox(height: 16),
        Text(
          'VendorCenter',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.textOf(context)),
        ),
        const SizedBox(height: 4),
        Text(
          context.tr('home.search_hint'),
          style: TextStyle(fontSize: 15, color: AppColors.textSecondaryOf(context)),
        ),
        const SizedBox(height: 40),

        // Phone method
        _MethodCard(
          icon: Icons.phone_android,
          iconBg: AppColors.primary.withAlpha(25),
          iconColor: AppColors.primary,
          title: context.tr('auth.login_phone'),
          subtitle: 'Quick login via SMS verification',
          onTap: () => _goToStep(AuthStep.phoneInput),
        ),
        const SizedBox(height: 12),

        // Email method
        _MethodCard(
          icon: Icons.email_outlined,
          iconBg: AppColors.info.withAlpha(25),
          iconColor: AppColors.info,
          title: context.tr('auth.login_email'),
          subtitle: 'Login with email and password',
          onTap: () => _goToStep(AuthStep.emailLogin),
        ),
        const SizedBox(height: 32),

        // Register link
        GestureDetector(
          onTap: () => context.push('/register'),
          child: Text.rich(
            TextSpan(
              text: '${context.tr('auth.no_account')} ',
              style: TextStyle(fontSize: 14, color: AppColors.textSecondaryOf(context)),
              children: [
                TextSpan(
                  text: context.tr('auth.register'),
                  style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ─── Phone input ───────────────────────────────
  Widget _buildPhoneInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _BackButton(onTap: () => _goToStep(AuthStep.method)),
        const SizedBox(height: 8),
        const Text('Enter your phone number',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text('We\'ll send a verification code via SMS',
            style: TextStyle(fontSize: 15, color: AppColors.textSecondaryOf(context))),
        const SizedBox(height: 24),

        // Phone field with country code
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.surfaceAltOf(context),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderOf(context)),
              ),
              child: const Row(
                children: [
                  Text('🇮🇳', style: TextStyle(fontSize: 20)),
                  SizedBox(width: 6),
                  Text('+91', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, letterSpacing: 2),
                decoration: const InputDecoration(
                  hintText: '98765 43210',
                  counterText: '',
                ),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                autofocus: true,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_error != null) _ErrorText(text: _error!),
        const SizedBox(height: 16),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _sendOtp,
            child: _loading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Get OTP'),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'By continuing, you agree to our Terms of Service and Privacy Policy',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 11, color: AppColors.textMutedOf(context)),
        ),
      ],
    );
  }

  // ─── OTP verification ─────────────────────────
  Widget _buildPhoneOtp() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _BackButton(onTap: () { _goToStep(AuthStep.phoneInput); _otpCtrl.clear(); }),
        const SizedBox(height: 8),
        const Text('Verify phone number',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text.rich(
          TextSpan(
            text: 'Enter the 6-digit code sent to\n',
            style: TextStyle(fontSize: 15, color: AppColors.textSecondaryOf(context)),
            children: [
              TextSpan(
                text: '+91 ${_phoneCtrl.text}',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textOf(context)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        TextField(
          controller: _otpCtrl,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: 14),
          decoration: const InputDecoration(counterText: ''),
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          autofocus: true,
          onChanged: (val) {
            if (val.length == 6) _verifyOtp();
          },
        ),
        const SizedBox(height: 8),
        if (_error != null) _ErrorText(text: _error!),
        const SizedBox(height: 16),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _verifyOtp,
            child: _loading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Verify'),
          ),
        ),
        const SizedBox(height: 16),

        Center(
          child: _countdown > 0
              ? Text('Resend in ${_countdown}s',
                  style: TextStyle(fontSize: 14, color: AppColors.textMutedOf(context)))
              : GestureDetector(
                  onTap: _sendOtp,
                  child: const Text('Resend OTP',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.primary)),
                ),
        ),
      ],
    );
  }

  // ─── Email login ───────────────────────────────
  Widget _buildEmailLogin() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _BackButton(onTap: () => _goToStep(AuthStep.method)),
        const SizedBox(height: 8),
        Text(context.tr('auth.login_email'),
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text('Enter your email and password',
            style: TextStyle(fontSize: 15, color: AppColors.textSecondaryOf(context))),
        const SizedBox(height: 24),

        TextField(
          controller: _emailCtrl,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(hintText: 'your@email.com'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _passwordCtrl,
          obscureText: true,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(hintText: 'Password'),
          onSubmitted: (_) => _emailLogin(),
        ),
        const SizedBox(height: 8),

        // Forgot password link
        Align(
          alignment: Alignment.centerRight,
          child: GestureDetector(
            onTap: () => context.push('/forgot-password'),
            child: Text(
              context.tr('auth.forgot_password'),
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        if (_error != null) _ErrorText(text: _error!),
        const SizedBox(height: 16),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _emailLogin,
            child: _loading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(context.tr('auth.login')),
          ),
        ),
      ],
    );
  }
}

// ─── Helper widgets ──────────────────────────────
class _MethodCard extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _MethodCard({
    required this.icon, required this.iconBg, required this.iconColor,
    required this.title, required this.subtitle, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surfaceOf(context),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.borderOf(context)),
          ),
          child: Row(
            children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: iconColor, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textOf(context))),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(fontSize: 13, color: AppColors.textSecondaryOf(context))),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: AppColors.textMutedOf(context)),
            ],
          ),
        ),
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  final VoidCallback onTap;
  const _BackButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.arrow_back, size: 22, color: AppColors.textOf(context)),
          const SizedBox(width: 4),
          Text('Back', style: TextStyle(fontSize: 15, color: AppColors.textOf(context))),
        ],
      ),
    );
  }
}

class _ErrorText extends StatelessWidget {
  final String text;
  const _ErrorText({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(text, textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: AppColors.error)),
    );
  }
}
