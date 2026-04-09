import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
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
  final _pincodeCtrl = TextEditingController();
  final _zoneCtrl = TextEditingController();
  final _radiusCtrl = TextEditingController();
  final _hoursCtrl = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _uploading = false;
  bool _lookingUpPincode = false;
  bool _detectingLocation = false;
  File? _avatarFile;
  String? _avatarUrl;
  List<String> _categories = [];
  double? _lat;
  double? _lng;
  String? _pincodeArea; // auto-filled from pincode lookup

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
    _pincodeCtrl.dispose();
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
        final zone = vendor['zone'] ?? '';
        _zoneCtrl.text = zone;
        // If zone looks like a 6-digit pincode, populate the pincode field
        if (RegExp(r'^\d{6}$').hasMatch(zone)) {
          _pincodeCtrl.text = zone;
        }
        final radius = vendor['serviceRadiusKm'];
        _radiusCtrl.text = (radius != null && radius != 0) ? radius.toString() : '';
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

  Future<void> _lookupPincode() async {
    final pin = _pincodeCtrl.text.trim();
    if (pin.length != 6 || int.tryParse(pin) == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid 6-digit pincode'), backgroundColor: AppColors.error),
      );
      return;
    }
    setState(() => _lookingUpPincode = true);
    try {
      final res = await _api.lookupPincode(pin);
      if (mounted) {
        final offices = res['offices'] as List? ?? [];
        if (offices.isNotEmpty) {
          final first = offices[0];
          final area = '${first['Name']}, ${first['District']}, ${first['State']}';
          setState(() {
            _pincodeArea = area;
            _zoneCtrl.text = pin;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Found: $area'), backgroundColor: AppColors.success),
          );
        } else {
          setState(() => _pincodeArea = null);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Pincode not found'), backgroundColor: AppColors.error),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _pincodeArea = null);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lookup failed: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _lookingUpPincode = false);
    }
  }

  Future<void> _detectLocation() async {
    setState(() => _detectingLocation = true);
    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever || perm == LocationPermission.denied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location permission denied'), backgroundColor: AppColors.error),
          );
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      if (mounted) {
        setState(() {
          _lat = pos.latitude;
          _lng = pos.longitude;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Location: ${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)}'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Location failed: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _detectingLocation = false);
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
        'zone': _pincodeCtrl.text.trim().isNotEmpty ? _pincodeCtrl.text.trim() : (_zoneCtrl.text.trim().isNotEmpty ? _zoneCtrl.text.trim() : 'Default'),
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

  static const _allCategories = [
    'Cleaning', 'Plumbing', 'Electrical', 'Painting',
    'Carpentry', 'Pest Control', 'AC Repair', 'Salon',
    'Appliance Repair', 'Moving', 'Photography', 'Catering',
  ];

  void _editCategories() async {
    final selected = List<String>.from(_categories);
    final customCtrl = TextEditingController();
    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Select Categories', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _allCategories.map((cat) {
                  final isSelected = selected.contains(cat);
                  return FilterChip(
                    label: Text(cat),
                    selected: isSelected,
                    onSelected: (val) {
                      setSheetState(() {
                        if (val) { selected.add(cat); } else { selected.remove(cat); }
                      });
                    },
                    selectedColor: AppColors.vendor.withValues(alpha: 0.15),
                    checkmarkColor: AppColors.vendor,
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: customCtrl,
                      decoration: InputDecoration(
                        hintText: 'Add custom category',
                        isDense: true,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.add_circle, color: AppColors.vendor),
                    onPressed: () {
                      final txt = customCtrl.text.trim();
                      if (txt.isNotEmpty && !selected.contains(txt)) {
                        setSheetState(() => selected.add(txt));
                        customCtrl.clear();
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel'))),
                  const SizedBox(width: 12),
                  Expanded(child: FilledButton(
                    onPressed: () => Navigator.pop(ctx, selected),
                    style: FilledButton.styleFrom(backgroundColor: AppColors.vendor),
                    child: const Text('Done'),
                  )),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (result != null && mounted) {
      setState(() => _categories = result);
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
                  const SizedBox(height: 20),

                  // Location section
                  Text('Location & Coverage', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textOf(context))),
                  const SizedBox(height: 12),

                  // Pincode with lookup
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _pincodeCtrl,
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                          decoration: _inputDeco('Pincode (6 digits)', Icons.pin_drop_outlined),
                          validator: (v) {
                            if (v == null || v.trim().isEmpty) return null; // optional
                            if (v.trim().length != 6 || int.tryParse(v.trim()) == null) return 'Enter valid 6-digit pincode';
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: SizedBox(
                          height: 48,
                          child: FilledButton.icon(
                            onPressed: _lookingUpPincode ? null : _lookupPincode,
                            icon: _lookingUpPincode
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.search, size: 18),
                            label: const Text('Lookup'),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.vendor,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (_pincodeArea != null) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle_outline, size: 16, color: AppColors.success),
                          const SizedBox(width: 8),
                          Expanded(child: Text(_pincodeArea!, style: const TextStyle(fontSize: 13, color: AppColors.success))),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),

                  // GPS location detect
                  OutlinedButton.icon(
                    onPressed: _detectingLocation ? null : _detectLocation,
                    icon: _detectingLocation
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.my_location, size: 18),
                    label: Text(_lat != null ? 'Location: ${_lat!.toStringAsFixed(4)}, ${_lng!.toStringAsFixed(4)}' : 'Detect My Location'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      side: BorderSide(color: AppColors.vendor.withValues(alpha: 0.5)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _radiusCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: _inputDeco('Service Radius (km)', Icons.radar_outlined),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return null; // use default
                      final n = double.tryParse(v.trim());
                      if (n == null || n <= 0) return 'Enter a valid radius (1-100)';
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
