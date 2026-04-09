import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/services/auth_service.dart';

class VendorEditProfileScreen extends StatefulWidget {
  const VendorEditProfileScreen({super.key});

  @override
  State<VendorEditProfileScreen> createState() => _VendorEditProfileScreenState();
}

class _VendorEditProfileScreenState extends State<VendorEditProfileScreen> {
  final _api = ApiService();
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  // User fields
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  // Business fields
  final _businessNameCtrl = TextEditingController();
  final _zoneCtrl = TextEditingController();
  final _radiusCtrl = TextEditingController();
  final _hoursCtrl = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _uploading = false;
  File? _avatarFile;
  String? _avatarUrl;
  List<String> _categories = [];
  double? _lat;
  double? _lng;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _businessNameCtrl.dispose();
    _zoneCtrl.dispose();
    _radiusCtrl.dispose();
    _hoursCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    try {
      final results = await Future.wait([
        _api.getProfile(),
        _api.getVendorProfile(),
      ]);
      final user = results[0];
      final vendor = results[1];
      if (mounted) {
        _nameCtrl.text = user['name'] ?? '';
        _phoneCtrl.text = user['phone'] ?? '';
        _avatarUrl = user['profilePictureUrl'] as String?;
        _businessNameCtrl.text = vendor['businessName'] ?? '';
        _zoneCtrl.text = vendor['zone'] ?? '';
        _radiusCtrl.text = (vendor['serviceRadiusKm'] ?? '').toString();
        _hoursCtrl.text = vendor['workingHours'] ?? '';
        _lat = vendor['latitude'] is num ? (vendor['latitude'] as num).toDouble() : null;
        _lng = vendor['longitude'] is num ? (vendor['longitude'] as num).toDouble() : null;
        final cats = vendor['serviceCategories'];
        if (cats is List) _categories = cats.map((c) => c.toString()).toList();
        setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(leading: const Icon(Icons.camera_alt), title: const Text('Take Photo'), onTap: () => Navigator.pop(ctx, ImageSource.camera)),
              ListTile(leading: const Icon(Icons.photo_library), title: const Text('Choose from Gallery'), onTap: () => Navigator.pop(ctx, ImageSource.gallery)),
            ],
          ),
        ),
      ),
    );
    if (source == null) return;
    final picked = await _picker.pickImage(source: source, maxWidth: 512, maxHeight: 512, imageQuality: 80);
    if (picked == null || !mounted) return;
    setState(() { _avatarFile = File(picked.path); _uploading = true; });
    try {
      final url = await _api.uploadFile(picked.path);
      if (url.isNotEmpty && mounted) {
        await _api.updateProfilePhoto(url);
        setState(() { _avatarUrl = url; _uploading = false; });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _uploading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e'), backgroundColor: AppColors.error));
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      // Update user profile (name, phone)
      final updated = await _api.updateProfile({
        'name': _nameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
      });
      if (mounted) context.read<AuthService>().updateUser(updated);

      // Update vendor business profile
      await _api.updateVendorProfile({
        'businessName': _businessNameCtrl.text.trim(),
        'serviceCategories': _categories.isNotEmpty ? _categories : ['General'],
        'latitude': _lat ?? 0.0,
        'longitude': _lng ?? 0.0,
        'zone': _zoneCtrl.text.trim().isNotEmpty ? _zoneCtrl.text.trim() : 'Default',
        'serviceRadiusKm': (double.tryParse(_radiusCtrl.text.trim()) ?? 10).clamp(1, 100),
        'workingHours': _hoursCtrl.text.trim().isNotEmpty ? _hoursCtrl.text.trim() : '9 AM - 6 PM',
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated'), backgroundColor: AppColors.success),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _editCategories() async {
    final ctrl = TextEditingController(text: _categories.join(', '));
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Service Categories'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            hintText: 'e.g. Plumbing, Electrician',
            helperText: 'Comma-separated list',
          ),
          maxLines: 2,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Save')),
        ],
      ),
    );
    if (result != null && mounted) {
      setState(() {
        _categories = result.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
      });
    }
  }

  InputDecoration _inputDeco(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, size: 20),
      filled: true,
      fillColor: AppColors.surfaceAltOf(context),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.vendor, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Profile'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Avatar
                  Center(
                    child: GestureDetector(
                      onTap: _uploading ? null : _pickPhoto,
                      child: Stack(
                        children: [
                          CircleAvatar(
                            radius: 48,
                            backgroundColor: AppColors.vendor.withValues(alpha: 0.1),
                            backgroundImage: _avatarFile != null
                                ? FileImage(_avatarFile!)
                                : (_avatarUrl != null && _avatarUrl!.isNotEmpty
                                    ? NetworkImage(_avatarUrl!) as ImageProvider
                                    : null),
                            child: _avatarFile == null && (_avatarUrl == null || _avatarUrl!.isEmpty)
                                ? const Icon(Icons.person, size: 40, color: AppColors.vendor)
                                : null,
                          ),
                          Positioned(
                            bottom: 0, right: 0,
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(color: AppColors.vendor, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
                              child: _uploading
                                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                  : const Icon(Icons.camera_alt, size: 14, color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Personal section
                  Text('Personal Information', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textOf(context))),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _nameCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: _inputDeco('Full Name', Icons.person_outline),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: _inputDeco('Phone', Icons.phone_outlined),
                  ),
                  const SizedBox(height: 24),

                  // Business section
                  Text('Business Information', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textOf(context))),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _businessNameCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: _inputDeco('Business Name', Icons.store_outlined),
                    validator: (v) => (v == null || v.trim().length < 2) ? 'Business name required' : null,
                  ),
                  const SizedBox(height: 12),

                  // Categories chip
                  GestureDetector(
                    onTap: _editCategories,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAltOf(context),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.category_outlined, size: 20, color: AppColors.textMutedOf(context)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _categories.isNotEmpty
                                ? Wrap(
                                    spacing: 6,
                                    runSpacing: 4,
                                    children: _categories.map((c) => Chip(
                                      label: Text(c, style: const TextStyle(fontSize: 12)),
                                      deleteIcon: const Icon(Icons.close, size: 14),
                                      onDeleted: () => setState(() => _categories.remove(c)),
                                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                      visualDensity: VisualDensity.compact,
                                    )).toList(),
                                  )
                                : Text('Tap to add categories', style: TextStyle(color: AppColors.textMutedOf(context))),
                          ),
                          Icon(Icons.edit_outlined, size: 16, color: AppColors.textMutedOf(context)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _zoneCtrl,
                    decoration: _inputDeco('Service Zone / Area', Icons.location_on_outlined),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _radiusCtrl,
                    keyboardType: TextInputType.number,
                    decoration: _inputDeco('Service Radius (km)', Icons.radar_outlined),
                    validator: (v) {
                      final n = double.tryParse(v ?? '');
                      if (n == null || n <= 0) return 'Enter a valid radius';
                      if (n > 100) return 'Maximum 100 km';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _hoursCtrl,
                    decoration: _inputDeco('Working Hours', Icons.access_time_outlined),
                  ),
                  const SizedBox(height: 28),

                  FilledButton(
                    onPressed: _saving ? null : _save,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.vendor,
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _saving
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }
}
