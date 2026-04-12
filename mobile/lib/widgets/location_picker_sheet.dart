import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/location_service.dart';

class LocationPickerSheet extends StatefulWidget {
  const LocationPickerSheet({super.key});

  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const LocationPickerSheet(),
    );
  }

  @override
  State<LocationPickerSheet> createState() => _LocationPickerSheetState();
}

class _LocationPickerSheetState extends State<LocationPickerSheet> {
  final _searchCtrl = TextEditingController();
  bool _showSearch = false;
  List<Map<String, String>> _searchResults = [];
  bool _searching = false;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounce?.cancel();
    final q = query.trim();
    if (q.isEmpty) {
      setState(() { _showSearch = false; _searchResults = []; _searching = false; });
      return;
    }
    setState(() { _showSearch = true; _searching = true; });
    // Check hardcoded list first
    final local = _allCities.where((c) => c['name']!.toLowerCase().contains(q.toLowerCase())).toList();
    if (local.isNotEmpty) {
      setState(() { _searchResults = local; _searching = false; });
      return;
    }
    // Debounce API call
    _debounce = Timer(const Duration(milliseconds: 400), () => _searchNominatim(q));
  }

  Future<void> _searchNominatim(String query) async {
    try {
      final uri = Uri.parse('https://nominatim.openstreetmap.org/search')
          .replace(queryParameters: {
        'q': '$query, India',
        'format': 'json',
        'limit': '8',
        'addressdetails': '1',
        'countrycodes': 'in',
      });
      final resp = await http.get(uri, headers: {'User-Agent': 'VendorCenter/1.0'});
      if (resp.statusCode == 200 && mounted) {
        final List data = jsonDecode(resp.body);
        final results = data.map<Map<String, String>>((item) {
          final addr = item['address'] ?? {};
          final state = addr['state'] ?? '';
          final city = addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['county'] ?? item['display_name']?.toString().split(',').first ?? query;
          return {
            'name': city,
            'lat': item['lat']?.toString() ?? '0',
            'lng': item['lon']?.toString() ?? '0',
            'state': state,
          };
        }).toList();
        // Deduplicate by name
        final seen = <String>{};
        results.retainWhere((r) => seen.add(r['name']!.toLowerCase()));
        if (mounted) setState(() { _searchResults = results; _searching = false; });
      }
    } catch (_) {
      if (mounted) setState(() => _searching = false);
    }
  }

  List<Map<String, String>> get _filteredCities {
    if (_showSearch) return _searchResults;
    return _popularCities;
  }

  @override
  Widget build(BuildContext context) {
    final loc = context.watch<LocationService>();
    final bottomPad = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
      padding: EdgeInsets.only(bottom: bottomPad),
      decoration: BoxDecoration(
        color: AppColors.surfaceOf(context),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 10),
            width: 40, height: 4,
            decoration: BoxDecoration(color: AppColors.borderOf(context), borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),

          // Title + close
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Text(
                  'Select delivery address',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textOf(context)),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Search bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surfaceAltOf(context),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderOf(context)),
              ),
              child: TextField(
                controller: _searchCtrl,
                onChanged: _onSearchChanged,
                decoration: InputDecoration(
                  hintText: 'Search by area, city, or pin code',
                  hintStyle: TextStyle(fontSize: 14, color: AppColors.textMutedOf(context)),
                  prefixIcon: Icon(Icons.search_rounded, size: 20, color: AppColors.textMutedOf(context)),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _searchCtrl.clear(); setState(() => _showSearch = false); })
                      : null,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: InputBorder.none,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Current location button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () async {
                  final success = await loc.useCurrentLocation();
                  if (success && context.mounted) Navigator.pop(context);
                },
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                    color: AppColors.primary.withValues(alpha: 0.04),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: loc.loading
                            ? const SizedBox(
                                width: 20, height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                              )
                            : const Icon(Icons.my_location_rounded, color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Use Current Location',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.primary),
                            ),
                            Text(
                              'Using GPS',
                              style: TextStyle(fontSize: 12, color: AppColors.textMutedOf(context)),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: AppColors.primary),
                    ],
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Saved addresses
          if (loc.savedAddresses.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'SAVED ADDRESSES',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMutedOf(context),
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            ...loc.savedAddresses.asMap().entries.map((entry) {
              final i = entry.key;
              final addr = entry.value;
              final isActive = loc.lat == addr.lat && loc.lng == addr.lng;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                child: Material(
                  color: Colors.transparent,
                  child: ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: isActive ? AppColors.primary.withValues(alpha: 0.06) : null,
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: (isActive ? AppColors.primary : AppColors.textMutedOf(context)).withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        addr.label.toLowerCase().contains('home') ? Icons.home_rounded
                            : addr.label.toLowerCase().contains('work') ? Icons.work_rounded
                            : Icons.location_on_rounded,
                        size: 18,
                        color: isActive ? AppColors.primary : AppColors.textSecondaryOf(context),
                      ),
                    ),
                    title: Text(addr.label, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textOf(context))),
                    subtitle: Text(addr.address, style: TextStyle(fontSize: 12, color: AppColors.textMutedOf(context)), maxLines: 1, overflow: TextOverflow.ellipsis),
                    trailing: isActive
                        ? const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 20)
                        : IconButton(
                            icon: Icon(Icons.close, size: 16, color: AppColors.textMutedOf(context)),
                            onPressed: () => loc.removeSavedAddress(i),
                          ),
                    onTap: () {
                      loc.setLocation(addr.lat, addr.lng, addr.label);
                      Navigator.pop(context);
                    },
                  ),
                ),
              );
            }),
            const SizedBox(height: 8),
          ],

          // Search results or popular cities
          if (_showSearch) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'SEARCH RESULTS',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMutedOf(context), letterSpacing: 0.8),
                ),
              ),
            ),
            const SizedBox(height: 8),
            if (_searching)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              )
            else if (_filteredCities.isEmpty)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text('No cities found', style: TextStyle(color: AppColors.textMutedOf(context))),
              )
            else
              ..._filteredCities.map((city) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                child: ListTile(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  leading: Icon(Icons.location_on_outlined, color: AppColors.textSecondaryOf(context)),
                  title: Text(city['name']!, style: TextStyle(fontWeight: FontWeight.w500, color: AppColors.textOf(context))),
                  subtitle: Text(city['state'] ?? 'Maharashtra', style: TextStyle(fontSize: 12, color: AppColors.textMutedOf(context))),
                  onTap: () {
                    loc.setLocation(double.parse(city['lat']!), double.parse(city['lng']!), city['name']!);
                    Navigator.pop(context);
                  },
                ),
              )),
          ] else ...[
            // Popular cities section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'POPULAR CITIES',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textMutedOf(context),
                  letterSpacing: 0.8,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _popularCities.map((city) {
                final isActive = loc.locationLabel == city['name'];
                return ActionChip(
                  label: Text(city['name']!, style: TextStyle(
                    fontSize: 13,
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                    color: isActive ? Colors.white : AppColors.textOf(context),
                  )),
                  avatar: Icon(Icons.location_city_rounded, size: 16,
                    color: isActive ? Colors.white : AppColors.textSecondaryOf(context)),
                  backgroundColor: isActive ? AppColors.primary : AppColors.surfaceAltOf(context),
                  side: BorderSide(color: isActive ? AppColors.primary : AppColors.borderOf(context)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  onPressed: () {
                    loc.setLocation(
                      double.parse(city['lat']!),
                      double.parse(city['lng']!),
                      city['name']!,
                    );
                    Navigator.pop(context);
                  },
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),
          ], // end else
        ],
       ),
      ),
    );
  }

  static const _popularCities = [
    {'name': 'Mumbai', 'lat': '19.0760', 'lng': '72.8777', 'state': 'Maharashtra'},
    {'name': 'Pune', 'lat': '18.5204', 'lng': '73.8567', 'state': 'Maharashtra'},
    {'name': 'Latur', 'lat': '18.3972', 'lng': '76.5604', 'state': 'Maharashtra'},
    {'name': 'Ratnagiri', 'lat': '16.9902', 'lng': '73.3120', 'state': 'Maharashtra'},
    {'name': 'Delhi', 'lat': '28.6139', 'lng': '77.2090', 'state': 'Delhi'},
    {'name': 'Bangalore', 'lat': '12.9716', 'lng': '77.5946', 'state': 'Karnataka'},
  ];

  static const _allCities = [
    {'name': 'Mumbai', 'lat': '19.0760', 'lng': '72.8777', 'state': 'Maharashtra'},
    {'name': 'Pune', 'lat': '18.5204', 'lng': '73.8567', 'state': 'Maharashtra'},
    {'name': 'Latur', 'lat': '18.3972', 'lng': '76.5604', 'state': 'Maharashtra'},
    {'name': 'Ratnagiri', 'lat': '16.9902', 'lng': '73.3120', 'state': 'Maharashtra'},
    {'name': 'Nagpur', 'lat': '21.1458', 'lng': '79.0882', 'state': 'Maharashtra'},
    {'name': 'Nashik', 'lat': '19.9975', 'lng': '73.7898', 'state': 'Maharashtra'},
    {'name': 'Aurangabad', 'lat': '19.8762', 'lng': '75.3433', 'state': 'Maharashtra'},
    {'name': 'Kolhapur', 'lat': '16.7050', 'lng': '74.2433', 'state': 'Maharashtra'},
    {'name': 'Solapur', 'lat': '17.6599', 'lng': '75.9064', 'state': 'Maharashtra'},
    {'name': 'Thane', 'lat': '19.2183', 'lng': '72.9781', 'state': 'Maharashtra'},
    {'name': 'Navi Mumbai', 'lat': '19.0330', 'lng': '73.0297', 'state': 'Maharashtra'},
    {'name': 'Delhi', 'lat': '28.6139', 'lng': '77.2090', 'state': 'Delhi'},
    {'name': 'Bangalore', 'lat': '12.9716', 'lng': '77.5946', 'state': 'Karnataka'},
    {'name': 'Hyderabad', 'lat': '17.3850', 'lng': '78.4867', 'state': 'Telangana'},
    {'name': 'Chennai', 'lat': '13.0827', 'lng': '80.2707', 'state': 'Tamil Nadu'},
    {'name': 'Ahmedabad', 'lat': '23.0225', 'lng': '72.5714', 'state': 'Gujarat'},
    {'name': 'Jaipur', 'lat': '26.9124', 'lng': '75.7873', 'state': 'Rajasthan'},
    {'name': 'Lucknow', 'lat': '26.8467', 'lng': '80.9462', 'state': 'Uttar Pradesh'},
    {'name': 'Indore', 'lat': '22.7196', 'lng': '75.8577', 'state': 'Madhya Pradesh'},
    {'name': 'Surat', 'lat': '21.1702', 'lng': '72.8311', 'state': 'Gujarat'},
  ];
}
