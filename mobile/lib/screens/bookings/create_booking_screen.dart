import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';

class CreateBookingScreen extends StatefulWidget {
  final String vendorId;
  const CreateBookingScreen({super.key, required this.vendorId});

  @override
  State<CreateBookingScreen> createState() => _CreateBookingScreenState();
}

class _CreateBookingScreenState extends State<CreateBookingScreen> {
  final _api = ApiService();
  final _formKey = GlobalKey<FormState>();
  final _notesCtrl = TextEditingController();

  Map<String, dynamic>? _vendor;
  List<dynamic> _services = [];
  dynamic _selectedService;
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _selectedTime = const TimeOfDay(hour: 10, minute: 0);
  bool _loading = true;
  bool _submitting = false;

  // Slots
  List<dynamic> _availableSlots = [];
  bool _loadingSlots = false;
  String? _selectedSlotTime;

  // Address
  List<dynamic> _addresses = [];
  String? _selectedAddressId;
  String? _selectedPincode;
  bool? _addressServiceable;

  @override
  void initState() {
    super.initState();
    _loadVendorData();
    _loadAddresses();
    _loadSlots();
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadVendorData() async {
    try {
      final vendor = await _api.getVendorDetail(widget.vendorId);
      if (mounted) {
        setState(() {
          _vendor = vendor;
          _services = (vendor['services'] as List<dynamic>?) ?? [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadAddresses() async {
    try {
      final list = await _api.getAddresses();
      if (mounted && list.isNotEmpty) {
        final defaultAddr = list.firstWhere((a) => a['isDefault'] == true, orElse: () => list.first);
        setState(() {
          _addresses = list;
          _selectedAddressId = defaultAddr['id'];
          _selectedPincode = defaultAddr['pincode'];
        });
        _checkAddressServiceability(defaultAddr['pincode'] ?? '');
      }
    } catch (_) {}
  }

  Future<void> _checkAddressServiceability(String pincode) async {
    if (pincode.length != 6) return;
    try {
      final res = await _api.checkServiceability(pincode);
      if (mounted) setState(() => _addressServiceable = res['serviceable'] == true);
    } catch (_) {}
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (date != null && mounted) {
      setState(() {
        _selectedDate = date;
        _selectedSlotTime = null;
      });
      _loadSlots();
    }
  }

  Future<void> _loadSlots() async {
    setState(() => _loadingSlots = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final slots = await _api.getAvailableSlots(widget.vendorId, dateStr);
      if (mounted) {
        setState(() {
          _availableSlots = slots;
          _loadingSlots = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() { _availableSlots = []; _loadingSlots = false; });
    }
  }

  Future<void> _pickTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
    );
    if (time != null && mounted) setState(() => _selectedTime = time);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedService == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a service')),
      );
      return;
    }
    if (_selectedAddressId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a service address before booking.')),
      );
      return;
    }
    if (_addressServiceable == false) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your selected address is not in a serviceable area yet. Please choose a different address.')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final timeStr = _selectedSlotTime ?? '${_selectedTime.hour.toString().padLeft(2, '0')}:${_selectedTime.minute.toString().padLeft(2, '0')}';
      await _api.createBooking(
        vendorId: widget.vendorId,
        serviceName: _selectedService['name']?.toString() ?? '',
        date: DateFormat('yyyy-MM-dd').format(_selectedDate),
        time: timeStr,
        notes: _notesCtrl.text.trim(),
        addressId: _selectedAddressId,
        pincode: _selectedPincode,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Booking created!'), backgroundColor: AppColors.success),
        );
        context.go('/bookings');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Book Service'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: _loading
          ? _buildShimmer()
          : _vendor == null
              ? const Center(child: Text('Vendor not found'))
              : _buildForm(),
    );
  }

  Widget _buildForm() {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Vendor info
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  child: const Icon(Icons.storefront, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _vendor!['business_name'] ?? 'Vendor',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        _vendor!['category'] ?? '',
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Service selector
          const Text('Select Service', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (_services.isEmpty)
            const Text('No services available', style: TextStyle(color: AppColors.textMuted))
          else
            ..._services.map((s) {
              final isSelected = _selectedService?['id'] == s['id'];
              return GestureDetector(
                onTap: () => setState(() => _selectedService = s),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isSelected ? AppColors.primary : AppColors.border, width: isSelected ? 2 : 1),
                    color: isSelected ? AppColors.primary.withValues(alpha: 0.05) : AppColors.surfaceOf(context),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(s['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w500)),
                            if (s['description'] != null)
                              Text(s['description'], style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      Text('₹${s['price'] ?? '0'}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary)),
                    ],
                  ),
                ),
              );
            }),

          const SizedBox(height: 20),

          // Service address
          const Text('Service Address', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (_addresses.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  isExpanded: true,
                  value: _selectedAddressId,
                  hint: const Text('Select address'),
                  items: _addresses.map<DropdownMenuItem<String>>((a) {
                    final label = a['label'] ?? 'Address';
                    final addr = (a['fullAddress'] ?? '').toString();
                    final pin = a['pincode'] ?? '';
                    final display = '$label — ${addr.length > 30 ? '${addr.substring(0, 30)}...' : addr} ($pin)';
                    return DropdownMenuItem(value: a['id'], child: Text(display, style: const TextStyle(fontSize: 13)));
                  }).toList(),
                  onChanged: (val) {
                    final addr = _addresses.firstWhere((a) => a['id'] == val, orElse: () => null);
                    setState(() {
                      _selectedAddressId = val;
                      _selectedPincode = addr?['pincode'];
                      _addressServiceable = null;
                    });
                    if (addr?['pincode'] != null) _checkAddressServiceability(addr['pincode']);
                  },
                ),
              ),
            )
          else
            Row(
              children: [
                const Text('No saved addresses ', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                GestureDetector(
                  onTap: () => context.push('/addresses'),
                  child: const Text('Add one', style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
                ),
              ],
            ),
          if (_addressServiceable == true)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                children: const [
                  Icon(Icons.check_circle, size: 14, color: AppColors.success),
                  SizedBox(width: 4),
                  Text('This area is serviceable', style: TextStyle(fontSize: 12, color: AppColors.success)),
                ],
              ),
            ),
          if (_addressServiceable == false)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                children: const [
                  Icon(Icons.warning_amber, size: 14, color: AppColors.warning),
                  SizedBox(width: 4),
                  Expanded(child: Text('This area may not be serviceable yet', style: TextStyle(fontSize: 12, color: AppColors.warning))),
                ],
              ),
            ),

          const SizedBox(height: 20),

          // Date picker
          const Text('Preferred Date', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today, size: 18, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Text(DateFormat('EEEE, dd MMM yyyy').format(_selectedDate)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Time slot selector
          const Text('Preferred Time', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (_loadingSlots)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
            )
          else if (_availableSlots.isNotEmpty)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _availableSlots.map<Widget>((s) {
                final time = s['time']?.toString() ?? '';
                final booked = s['booked'] == true;
                final selected = _selectedSlotTime == time;
                return ChoiceChip(
                  label: Text(time),
                  selected: selected,
                  onSelected: booked ? null : (v) => setState(() => _selectedSlotTime = v ? time : null),
                  selectedColor: AppColors.primary.withValues(alpha: 0.2),
                  disabledColor: Colors.grey.shade200,
                  labelStyle: TextStyle(
                    color: booked ? Colors.grey : (selected ? AppColors.primary : null),
                    decoration: booked ? TextDecoration.lineThrough : null,
                  ),
                );
              }).toList(),
            )
          else
            // Fallback to manual time picker when vendor has no slots configured
            InkWell(
              onTap: _pickTime,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.access_time, size: 18, color: AppColors.primary),
                    const SizedBox(width: 10),
                    Text(_selectedTime.format(context)),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),

          // Notes
          const Text('Notes (optional)', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextFormField(
            controller: _notesCtrl,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Any special requirements...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
          const SizedBox(height: 24),

          // Submit
          FilledButton(
            onPressed: _submitting ? null : _submit,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _submitting
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text('Book${_selectedService != null ? " — ₹${_selectedService['price']}" : ""}'),
          ),
        ],
      ),
    );
  }

  Widget _buildShimmer() {
    return Shimmer.fromColors(
      baseColor: AppColors.isDark(context) ? AppColors.darkSurfaceAlt : Colors.grey.shade200,
      highlightColor: AppColors.isDark(context) ? AppColors.darkBorder : Colors.grey.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: List.generate(4, (_) => Container(
          height: 60, margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(12)),
        ))),
      ),
    );
  }
}
