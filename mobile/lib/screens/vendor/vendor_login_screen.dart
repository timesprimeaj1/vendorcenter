import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:vendorcenter/config/theme.dart';
import 'package:go_router/go_router.dart';
import 'package:vendorcenter/services/auth_service.dart';
import 'package:vendorcenter/services/api_service.dart';

class VendorLoginScreen extends StatefulWidget {
  const VendorLoginScreen({super.key});

  @override
  State<VendorLoginScreen> createState() => _VendorLoginScreenState();
}

class _VendorLoginScreenState extends State<VendorLoginScreen> {
  final _phoneCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();

  int _step = 0; // 0=choose, 1=phone, 2=email, 3=otp
  bool _loading = false;
  String? _error;
  String _verificationId = '';
  int _resendCountdown = 0;
  Timer? _resendTimer;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 40),
              // Brand
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: AppColors.vendor,
                ),
                child: const Center(
                  child: Text('V', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Vendor Portal',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.text),
              ),
              const SizedBox(height: 6),
              const Text(
                'Manage your business on VendorCenter',
                style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 32),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.error, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13))),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Steps
              if (_step == 0) _buildChooseMethod(),
              if (_step == 1) _buildPhoneInput(),
              if (_step == 2) _buildEmailInput(),
              if (_step == 3) _buildOtpInput(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChooseMethod() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () => setState(() { _step = 1; _error = null; }),
            icon: const Icon(Icons.phone),
            label: const Text('Login with Phone'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.vendor,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => setState(() { _step = 2; _error = null; }),
            icon: const Icon(Icons.email_outlined),
            label: const Text('Login with Email'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ),
        const SizedBox(height: 20),
        Center(
          child: TextButton(
            onPressed: () => GoRouter.of(context).go('/register'),
            child: const Text("Don't have an account? Sign up"),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Phone Number', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(
          controller: _phoneCtrl,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          decoration: const InputDecoration(
            prefixText: '+91 ',
            hintText: 'Enter 10-digit number',
            counterText: '',
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _sendOtp,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.vendor),
            child: _loading
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Send OTP'),
          ),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => setState(() { _step = 0; _error = null; }),
          child: const Text('← Back to options'),
        ),
      ],
    );
  }

  Widget _buildEmailInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Email', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(
          controller: _emailCtrl,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(hintText: 'vendor@example.com'),
        ),
        const SizedBox(height: 12),
        const Text('Password', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(
          controller: _passCtrl,
          obscureText: true,
          decoration: const InputDecoration(hintText: 'Enter your password'),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _emailLogin,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.vendor),
            child: _loading
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Login'),
          ),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => setState(() { _step = 0; _error = null; }),
          child: const Text('← Back to options'),
        ),
      ],
    );
  }

  Widget _buildOtpInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'OTP sent to +91 ${_phoneCtrl.text}',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _otpCtrl,
          keyboardType: TextInputType.number,
          maxLength: 6,
          decoration: const InputDecoration(
            hintText: 'Enter 6-digit OTP',
            counterText: '',
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _verifyOtp,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.vendor),
            child: _loading
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Verify & Login'),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(
              onPressed: () => setState(() { _step = 1; _error = null; }),
              child: const Text('← Change number'),
            ),
            if (_resendCountdown > 0)
              Text('Resend in ${_resendCountdown}s', style: const TextStyle(color: AppColors.textMuted, fontSize: 13))
            else
              TextButton(onPressed: _sendOtp, child: const Text('Resend OTP')),
          ],
        ),
      ],
    );
  }

  Future<void> _sendOtp() async {
    final phone = _phoneCtrl.text.trim();
    if (phone.length != 10) {
      setState(() => _error = 'Enter a valid 10-digit phone number');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
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

      await fb.FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: '+91$phone',
        verificationCompleted: (credential) async {
          // Auto-verify on some devices
          await _signInWithCredential(credential);
        },
        verificationFailed: (e) {
          if (mounted) {
            setState(() { _loading = false; _error = e.message ?? 'Verification failed'; });
          }
        },
        codeSent: (verificationId, _) {
          if (mounted) {
            setState(() {
              _verificationId = verificationId;
              _step = 3;
              _loading = false;
              _resendCountdown = 30;
            });
          }
          _startResendTimer();
        },
        codeAutoRetrievalTimeout: (id) { _verificationId = id; },
        timeout: const Duration(seconds: 60),
      );
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = 'Failed to send OTP: $e'; });
    }
  }

  void _startResendTimer() {
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted || _resendCountdown <= 1) {
        t.cancel();
      }
      if (mounted) setState(() => _resendCountdown--);
    });
  }

  Future<void> _verifyOtp() async {
    final otp = _otpCtrl.text.trim();
    if (otp.length != 6) {
      setState(() => _error = 'Enter 6-digit OTP');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final credential = fb.PhoneAuthProvider.credential(
        verificationId: _verificationId,
        smsCode: otp,
      );
      await _signInWithCredential(credential);
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = 'Invalid OTP. Please try again.'; });
    }
  }

  Future<void> _signInWithCredential(fb.AuthCredential credential) async {
    try {
      final userCred = await fb.FirebaseAuth.instance.signInWithCredential(credential);
      final idToken = await userCred.user!.getIdToken();
      if (idToken == null) throw Exception('Failed to get Firebase token');

      if (!mounted) return;
      final auth = context.read<AuthService>();
      await auth.phoneLogin(idToken, role: 'vendor');
    } catch (e) {
      if (mounted) {
        final s = e.toString().toLowerCase();
        String msg = 'Login failed. Please try again.';
        if (s.contains('billing') || s.contains('quota')) {
          msg = 'SMS service temporarily unavailable. Please use email login.';
        } else if (s.contains('network') || s.contains('connection')) {
          msg = 'Network error. Please check your internet.';
        }
        setState(() { _loading = false; _error = msg; });
      }
    }
  }

  Future<void> _emailLogin() async {
    final email = _emailCtrl.text.trim();
    final pass = _passCtrl.text;
    if (email.isEmpty || pass.isEmpty) {
      setState(() => _error = 'Enter email and password');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final auth = context.read<AuthService>();
      await auth.login(email, pass, role: 'vendor');
    } catch (e) {
      if (mounted) {
        final msg = _friendlyError(e);
        setState(() { _loading = false; _error = msg; });
      }
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
}
