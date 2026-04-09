import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';

enum ForgotStep { email, otp, newPassword, success }

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with SingleTickerProviderStateMixin {
  ForgotStep _step = ForgotStep.email;
  final _emailCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  final _api = ApiService();

  bool _loading = false;
  bool _obscure1 = true;
  bool _obscure2 = true;
  String? _error;
  String? _otpId;
  String? _verifiedCode;

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
      begin: const Offset(0.12, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOutCubic));
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _otpCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    _slideCtrl.dispose();
    super.dispose();
  }

  void _goToStep(ForgotStep step) {
    setState(() {
      _step = step;
      _error = null;
    });
    _slideCtrl.forward(from: 0);
  }

  Future<void> _requestReset() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid email address');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await _api.requestPasswordReset(email);
      if (mounted) {
        _otpId = res['data']?['otpId'] as String?;
        setState(() => _loading = false);
        _goToStep(ForgotStep.otp);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not send reset email. Check your email address.';
        });
      }
    }
  }

  Future<void> _verifyOtp() async {
    final code = _otpCtrl.text.trim();
    if (code.length < 4) {
      setState(() => _error = 'Enter the verification code');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await _api.verifyOtp(
        identifier: _otpId ?? _emailCtrl.text.trim(),
        code: code,
        purpose: 'password_reset',
      );
      if (mounted) {
        _verifiedCode = code;
        setState(() => _loading = false);
        _goToStep(ForgotStep.newPassword);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Invalid code. Please try again.';
        });
      }
    }
  }

  Future<void> _resetPassword() async {
    if (_passwordCtrl.text.length < 6) {
      setState(() => _error = 'Minimum 6 characters');
      return;
    }
    if (_passwordCtrl.text != _confirmCtrl.text) {
      setState(() => _error = 'Passwords do not match');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await _api.resetPassword(
        email: _emailCtrl.text.trim(),
        otpId: _otpId ?? '',
        code: _verifiedCode ?? '',
        newPassword: _passwordCtrl.text,
      );
      if (mounted) {
        setState(() => _loading = false);
        _goToStep(ForgotStep.success);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Failed to reset password. Try again.';
        });
      }
    }
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
      case ForgotStep.email:
        return _buildEmailStep();
      case ForgotStep.otp:
        return SlideTransition(
            position: _slideAnim, child: _buildOtpStep());
      case ForgotStep.newPassword:
        return SlideTransition(
            position: _slideAnim, child: _buildNewPasswordStep());
      case ForgotStep.success:
        return SlideTransition(
            position: _slideAnim, child: _buildSuccessStep());
    }
  }

  Widget _buildEmailStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => context.go('/login'),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.arrow_back, size: 22, color: AppColors.textOf(context)),
              const SizedBox(width: 4),
              Text('Back',
                  style:
                      TextStyle(fontSize: 15, color: AppColors.textOf(context))),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.warning.withAlpha(25),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(Icons.lock_reset, size: 30, color: AppColors.warning),
        ),
        const SizedBox(height: 16),
        Text(
          'Reset Password',
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w700,
            color: AppColors.textOf(context),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Enter your email and we\'ll send a verification code',
          style: TextStyle(
            fontSize: 15,
            color: AppColors.textSecondaryOf(context),
          ),
        ),
        const SizedBox(height: 28),
        TextField(
          controller: _emailCtrl,
          keyboardType: TextInputType.emailAddress,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'your@email.com',
            prefixIcon: Icon(Icons.email_outlined, size: 20),
          ),
        ),
        const SizedBox(height: 8),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(_error!,
                style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _requestReset,
            child: _loading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Send Code'),
          ),
        ),
      ],
    );
  }

  Widget _buildOtpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => _goToStep(ForgotStep.email),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.arrow_back, size: 22, color: AppColors.textOf(context)),
              const SizedBox(width: 4),
              Text('Back',
                  style:
                      TextStyle(fontSize: 15, color: AppColors.textOf(context))),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Text('Check Your Email',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text.rich(
          TextSpan(
            text: 'Enter the code sent to\n',
            style: TextStyle(
                fontSize: 15, color: AppColors.textSecondaryOf(context)),
            children: [
              TextSpan(
                text: _emailCtrl.text,
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textOf(context)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),
        TextField(
          controller: _otpCtrl,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: 12),
          decoration: const InputDecoration(counterText: ''),
          autofocus: true,
        ),
        const SizedBox(height: 8),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(_error!,
                style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _verifyOtp,
            child: _loading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Verify Code'),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: GestureDetector(
            onTap: _loading ? null : _requestReset,
            child: const Text('Resend Code',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary)),
          ),
        ),
      ],
    );
  }

  Widget _buildNewPasswordStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Set New Password',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(
          'Choose a strong password for your account',
          style: TextStyle(
              fontSize: 15, color: AppColors.textSecondaryOf(context)),
        ),
        const SizedBox(height: 28),
        TextField(
          controller: _passwordCtrl,
          obscureText: _obscure1,
          decoration: InputDecoration(
            hintText: 'New Password',
            prefixIcon: const Icon(Icons.lock_outline, size: 20),
            suffixIcon: IconButton(
              icon: Icon(
                  _obscure1 ? Icons.visibility_off_outlined : Icons.visibility_outlined),
              onPressed: () => setState(() => _obscure1 = !_obscure1),
            ),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _confirmCtrl,
          obscureText: _obscure2,
          decoration: InputDecoration(
            hintText: 'Confirm Password',
            prefixIcon: const Icon(Icons.lock_outline, size: 20),
            suffixIcon: IconButton(
              icon: Icon(
                  _obscure2 ? Icons.visibility_off_outlined : Icons.visibility_outlined),
              onPressed: () => setState(() => _obscure2 = !_obscure2),
            ),
          ),
        ),
        const SizedBox(height: 8),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(_error!,
                style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _resetPassword,
            child: _loading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Reset Password'),
          ),
        ),
      ],
    );
  }

  Widget _buildSuccessStep() {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: AppColors.success.withAlpha(25),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_circle,
              size: 48, color: AppColors.success),
        ),
        const SizedBox(height: 20),
        Text(
          'Password Reset!',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: AppColors.textOf(context),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Your password has been updated successfully. You can now login with your new password.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 15,
            color: AppColors.textSecondaryOf(context),
          ),
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => context.go('/login'),
            child: const Text('Back to Login'),
          ),
        ),
      ],
    );
  }
}
