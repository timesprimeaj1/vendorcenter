import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/services/localization_service.dart';
import 'package:vendorcenter/services/location_service.dart';
import 'package:vendorcenter/widgets/vendor_card.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _api = ApiService();
  final _searchCtrl = TextEditingController();
  List<dynamic> _categories = [];
  List<dynamic> _vendors = [];
  String? _activeCategory;
  bool _loading = true;
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final uri = GoRouterState.of(context).uri;
    final cat = uri.queryParameters['category'];
    if (cat != null && cat != _activeCategory) {
      _activeCategory = cat;
      _loadVendors(cat);
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final cats = await _api.getCategories();
      if (mounted) {
        setState(() {
          _categories = cats;
          _loading = false;
        });
        // If no category selected, load all vendors
        if (_activeCategory == null && _vendors.isEmpty) {
          _loadAllVendors();
        }
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadAllVendors() async {
    setState(() => _searching = true);
    try {
      final loc = context.read<LocationService>();
      final vendors = await _api.getApprovedVendors(
        lat: loc.hasLocation ? loc.lat : null,
        lng: loc.hasLocation ? loc.lng : null,
      );
      if (mounted) setState(() { _vendors = vendors; _searching = false; });
    } catch (e) {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _loadVendors(String category) async {
    setState(() => _searching = true);
    try {
      final loc = context.read<LocationService>();
      final vendors = await _api.getVendorsByCategory(
        category,
        lat: loc.hasLocation ? loc.lat : null,
        lng: loc.hasLocation ? loc.lng : null,
      );
      if (mounted) setState(() { _vendors = vendors; _searching = false; });
    } catch (e) {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _onCategoryTap(String cat) {
    if (_activeCategory == cat) {
      setState(() => _activeCategory = null);
      _loadAllVendors();
    } else {
      setState(() => _activeCategory = cat);
      _loadVendors(cat);
    }
  }

  List<dynamic> get _filteredVendors {
    final query = _searchCtrl.text.toLowerCase().trim();
    if (query.isEmpty) return _vendors;
    return _vendors.where((v) {
      final name = (v['businessName'] ?? v['business_name'] ?? '').toString().toLowerCase();
      final cats = v['serviceCategories'] as List<dynamic>?;
      final cat = (cats != null && cats.isNotEmpty) ? cats.first.toString().toLowerCase() : (v['category'] ?? '').toString().toLowerCase();
      return name.contains(query) || cat.contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final results = _filteredVendors;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Search bar (Stitch pattern - prominent, with filter icon)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAltOf(context),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.04),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: TextField(
                        controller: _searchCtrl,
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          hintText: context.tr('search.hint'),
                          hintStyle: TextStyle(color: AppColors.textMutedOf(context), fontSize: 14),
                          prefixIcon: Icon(Icons.search_rounded, size: 22, color: AppColors.textMutedOf(context)),
                          suffixIcon: _searchCtrl.text.isNotEmpty
                              ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () {
                                  _searchCtrl.clear();
                                  setState(() {});
                                })
                              : null,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          border: InputBorder.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.tune_rounded, size: 22, color: AppColors.primary),
                  ),
                ],
              ),
            ),

            // Filter chips row (Stitch pattern)
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _FilterChip(
                    label: 'All',
                    isActive: _activeCategory == null,
                    onTap: () { setState(() => _activeCategory = null); _loadAllVendors(); },
                  ),
                  if (_categories.isNotEmpty)
                    ..._categories.map((cat) {
                      final name = cat['cat'] ?? '';
                      return _FilterChip(
                        label: name,
                        isActive: _activeCategory == name,
                        onTap: () => _onCategoryTap(name),
                      );
                    }),
                ],
              ),
            ),

            const SizedBox(height: 4),

            // Result count (Stitch pattern)
            if (!_loading && !_searching && results.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '${results.length} vendor${results.length != 1 ? 's' : ''} found',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textSecondaryOf(context)),
                  ),
                ),
              ),

            // Results
            Expanded(
              child: _loading || _searching
                  ? _buildShimmer()
                  : results.isEmpty
                      ? _buildEmpty()
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                          itemCount: results.length,
                          itemBuilder: (_, i) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: VendorCard(vendor: results[i]),
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.search_off, size: 56, color: AppColors.textMutedOf(context)),
          const SizedBox(height: 12),
          Text(context.tr('search.no_results'), style: TextStyle(color: AppColors.textSecondaryOf(context))),
        ],
      ),
    );
  }

  Widget _buildShimmer() {
    final isDark = AppColors.isDark(context);
    return Shimmer.fromColors(
      baseColor: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade200,
      highlightColor: isDark ? const Color(0xFF3A3A3A) : Colors.grey.shade50,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 6,
        itemBuilder: (_, __) => Container(
          height: 90,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _FilterChip({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : AppColors.surfaceAltOf(context),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
              color: isActive ? Colors.white : AppColors.textOf(context),
            ),
          ),
        ),
      ),
    );
  }
}
