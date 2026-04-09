import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onComplete;
  const OnboardingScreen({super.key, required this.onComplete});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageCtrl = PageController();
  int _current = 0;

  static const _pages = [
    _SlideData(
      icon: Icons.search_rounded,
      accentIcon: Icons.home_repair_service_rounded,
      title: 'Discover Services',
      subtitle:
          'Find trusted local service providers — electricians, plumbers, cleaners, and more — all in one place.',
      gradient: [Color(0xFF004AC6), Color(0xFF2563EB)],
      bgAccent: Color(0xFFE8EEFF),
    ),
    _SlideData(
      icon: Icons.calendar_today_rounded,
      accentIcon: Icons.verified_rounded,
      title: 'Book with Confidence',
      subtitle:
          'Compare prices, read reviews, and book services with just a few taps. Secure payments guaranteed.',
      gradient: [Color(0xFF2563EB), Color(0xFF3B82F6)],
      bgAccent: Color(0xFFF2F3FF),
    ),
    _SlideData(
      icon: Icons.star_rounded,
      accentIcon: Icons.trending_up_rounded,
      title: 'Track & Review',
      subtitle:
          'Real-time booking updates, service tracking, and honest reviews to help the community.',
      gradient: [Color(0xFF004AC6), Color(0xFF3B82F6)],
      bgAccent: Color(0xFFEAF0FF),
    ),
  ];

  void _next() {
    if (_current < _pages.length - 1) {
      _pageCtrl.nextPage(
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOut);
    } else {
      widget.onComplete();
    }
  }

  void _skip() => widget.onComplete();

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    );
    final isLast = _current == _pages.length - 1;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // Top bar: Skip
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: isLast
                    ? const SizedBox(height: 40)
                    : GestureDetector(
                        onTap: _skip,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF2F3FF),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'Skip',
                            style: TextStyle(
                              color: Color(0xFF2563EB),
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
              ),
            ),

            // Illustration area
            Expanded(
              flex: 5,
              child: PageView.builder(
                controller: _pageCtrl,
                onPageChanged: (i) => setState(() => _current = i),
                itemCount: _pages.length,
                itemBuilder: (_, i) => _buildIllustration(_pages[i]),
              ),
            ),

            // Bottom content area
            Expanded(
              flex: 4,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Column(
                  children: [
                    const Spacer(flex: 1),
                    // Title
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: Text(
                        _pages[_current].title,
                        key: ValueKey(_current),
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF131B2E),
                          letterSpacing: -0.5,
                          height: 1.2,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 14),
                    // Subtitle
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: Text(
                        _pages[_current].subtitle,
                        key: ValueKey('sub$_current'),
                        style: const TextStyle(
                          fontSize: 15,
                          color: Color(0xFF737686),
                          height: 1.55,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const Spacer(flex: 2),

                    // Step indicator
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(_pages.length, (i) {
                        final active = i == _current;
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: active ? 28 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            gradient: active
                                ? const LinearGradient(
                                    colors: [
                                      Color(0xFF004AC6),
                                      Color(0xFF2563EB)
                                    ],
                                  )
                                : null,
                            color: active ? null : const Color(0xFFE0E4ED),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 24),

                    // CTA Button — consistent gradient
                    GestureDetector(
                      onTap: _next,
                      child: Container(
                        width: double.infinity,
                        height: 56,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF004AC6), Color(0xFF2563EB)],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color:
                                  const Color(0xFF2563EB).withValues(alpha: 0.3),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Center(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                isLast ? 'Get Started' : 'Continue',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.2,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(
                                isLast
                                    ? Icons.arrow_forward_rounded
                                    : Icons.east_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIllustration(_SlideData slide) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: Center(
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Outer tonal ring
            Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: slide.bgAccent,
              ),
            ),
            // Accent floating chip (top-right)
            Positioned(
              top: 10,
              right: 20,
              child: Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: slide.bgAccent,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: slide.gradient[0].withValues(alpha: 0.08),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(slide.accentIcon, size: 22, color: slide.gradient[1]),
              ),
            ),
            // Accent floating chip (bottom-left)
            Positioned(
              bottom: 16,
              left: 24,
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: slide.gradient[0].withValues(alpha: 0.1),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(Icons.check_circle_rounded,
                    size: 20, color: const Color(0xFF22C55E)),
              ),
            ),
            // Main icon circle — gradient
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: slide.gradient,
                ),
                boxShadow: [
                  BoxShadow(
                    color: slide.gradient[0].withValues(alpha: 0.25),
                    blurRadius: 32,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Icon(slide.icon, size: 52, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlideData {
  final IconData icon;
  final IconData accentIcon;
  final String title;
  final String subtitle;
  final List<Color> gradient;
  final Color bgAccent;
  const _SlideData({
    required this.icon,
    required this.accentIcon,
    required this.title,
    required this.subtitle,
    required this.gradient,
    required this.bgAccent,
  });
}
