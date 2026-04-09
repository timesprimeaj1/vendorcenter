import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:vendorcenter/services/auth_service.dart';
import 'package:vendorcenter/screens/auth/login_screen.dart';
import 'package:vendorcenter/screens/auth/register_screen.dart';
import 'package:vendorcenter/screens/auth/forgot_password_screen.dart';
import 'package:vendorcenter/screens/shell_screen.dart';
import 'package:vendorcenter/screens/home/home_screen.dart';
import 'package:vendorcenter/screens/search/search_screen.dart';
import 'package:vendorcenter/screens/bookings/bookings_screen.dart';
import 'package:vendorcenter/screens/profile/profile_screen.dart';
import 'package:vendorcenter/screens/profile/edit_profile_screen.dart';
import 'package:vendorcenter/screens/vendor/vendor_detail_screen.dart';
import 'package:vendorcenter/screens/bookings/booking_detail_screen.dart';
import 'package:vendorcenter/screens/bookings/create_booking_screen.dart';
import 'package:vendorcenter/screens/reviews/write_review_screen.dart';
import 'package:vendorcenter/screens/notifications/notifications_screen.dart';
import 'package:vendorcenter/screens/favorites/favorites_screen.dart';
import 'package:vendorcenter/screens/chat/ai_chat_screen.dart';
import 'package:vendorcenter/screens/support/support_screen.dart';
import 'package:vendorcenter/screens/explore/explore_screen.dart';
import 'package:vendorcenter/screens/addresses/customer_addresses_screen.dart';

/// Smooth slide-up transition for push routes
CustomTransitionPage<void> _slidePage(Widget child, GoRouterState state) {
  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 300),
    reverseTransitionDuration: const Duration(milliseconds: 250),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
      return SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero).animate(curved),
        child: FadeTransition(opacity: curved, child: child),
      );
    },
  );
}

GoRouter createRouter(AuthService auth) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: auth,
    redirect: (context, state) {
      final loggedIn = auth.isLoggedIn;
      final isOnLogin = state.matchedLocation == '/login';
      final path = state.matchedLocation;

      // Public routes — accessible without login (guest browsing)
      final isPublic = path == '/' ||
          path == '/search' ||
          path == '/explore' ||
          path.startsWith('/vendor/') ||
          path == '/notifications' ||
          path == '/chat' ||
          path == '/support';

      final isAuthPage = isOnLogin ||
          path == '/register' ||
          path == '/forgot-password';

      // If logged in with wrong role (vendor in customer app), force logout
      if (loggedIn && auth.user?['role'] != null && auth.user!['role'] != 'customer') {
        auth.logout();
        return '/login';
      }

      // If not logged in and route requires auth, redirect to login
      if (!loggedIn && !isAuthPage && !isPublic) return '/login';
      // If logged in and on auth page, go home
      if (loggedIn && isAuthPage) return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        pageBuilder: (_, state) => _slidePage(const RegisterScreen(), state),
      ),
      GoRoute(
        path: '/forgot-password',
        pageBuilder: (_, state) => _slidePage(const ForgotPasswordScreen(), state),
      ),
      ShellRoute(
        builder: (_, state, child) => ShellScreen(child: child),
        routes: [
          GoRoute(
            path: '/',
            pageBuilder: (_, __) => const NoTransitionPage(child: HomeScreen()),
          ),
          GoRoute(
            path: '/search',
            pageBuilder: (_, __) => const NoTransitionPage(child: SearchScreen()),
          ),
          GoRoute(
            path: '/bookings',
            pageBuilder: (_, __) => const NoTransitionPage(child: BookingsScreen()),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (_, __) => const NoTransitionPage(child: ProfileScreen()),
          ),
        ],
      ),
      GoRoute(
        path: '/vendor/:id',
        pageBuilder: (_, state) => _slidePage(
          VendorDetailScreen(vendorId: state.pathParameters['id']!),
          state,
        ),
      ),
      GoRoute(
        path: '/booking/:id',
        pageBuilder: (_, state) => _slidePage(
          BookingDetailScreen(bookingId: state.pathParameters['id']!),
          state,
        ),
      ),
      GoRoute(
        path: '/book/:vendorId',
        pageBuilder: (_, state) => _slidePage(
          CreateBookingScreen(vendorId: state.pathParameters['vendorId']!),
          state,
        ),
      ),
      GoRoute(
        path: '/profile/edit',
        pageBuilder: (_, state) => _slidePage(const EditProfileScreen(), state),
      ),
      GoRoute(
        path: '/review/:vendorId/:bookingId',
        pageBuilder: (_, state) => _slidePage(
          WriteReviewScreen(
            vendorId: state.pathParameters['vendorId']!,
            bookingId: state.pathParameters['bookingId']!,
          ),
          state,
        ),
      ),
      GoRoute(
        path: '/notifications',
        pageBuilder: (_, state) => _slidePage(const NotificationsScreen(), state),
      ),
      GoRoute(
        path: '/favorites',
        pageBuilder: (_, state) => _slidePage(const FavoritesScreen(), state),
      ),
      GoRoute(
        path: '/chat',
        pageBuilder: (_, state) => _slidePage(const AiChatScreen(), state),
      ),
      GoRoute(
        path: '/support',
        pageBuilder: (_, state) => _slidePage(const SupportScreen(), state),
      ),
      GoRoute(
        path: '/explore',
        pageBuilder: (_, state) => _slidePage(const ExploreScreen(), state),
      ),
      GoRoute(
        path: '/addresses',
        pageBuilder: (_, state) => _slidePage(const CustomerAddressesScreen(), state),
      ),
    ],
  );
}
