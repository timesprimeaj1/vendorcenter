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
  bool _hasSearched = false;
  double _minRating = 0;
  double _maxRadius = 50;

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
        // If category was pre-selected via route, load vendors for it
        if (_activeCategory != null) {
          _loadVendors(_activeCategory!);
        }
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadAllVendors() async {
    setState(() { _searching = true; _hasSearched = true; });
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
    setState(() { _searching = true; _hasSearched = true; });
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
    var list = _vendors;
    if (_minRating > 0) {
      list = list.where((v) => ((v['rating'] as num?) ?? 0) >= _minRating).toList();
    }
    if (query.isEmpty) return list;
    return list.where((v) {
      final name = (v['businessName'] ?? v['business_name'] ?? '').toString().toLowerCase();
      final cats = v['serviceCategories'] as List<dynamic>?;
      final cat = (cats != null && cats.isNotEmpty) ? cats.first.toString().toLowerCase() : (v['category'] ?? '').toString().toLowerCase();
      return name.contains(query) || cat.contains(query);
    }).toList();
  }

  void _showFilterSheet() {
    double tempRating = _minRating;
    double tempRadius = _maxRadius;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
              ),
              const SizedBox(height: 16),
              Text('Filters', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textOf(context))),
              const SizedBox(height: 20),
              Text('Minimum Rating', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textSecondaryOf(context))),
              Row(
                children: [
                  Expanded(
                    child: Slider(
                      value: tempRating,
                      min: 0, max: 5, divisions: 10,
                      label: tempRating == 0 ? 'Any' : tempRating.toStringAsFixed(1),
                      activeColor: AppColors.primary,
                      onChanged: (v) => setSheetState(() => tempRating = v),
                    ),
                  ),
                  SizedBox(
                    width: 40,
                    child: Text(tempRating == 0 ? 'Any' : tempRating.toStringAsFixed(1),
                      style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textOf(context)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text('Search Radius (km)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textSecondaryOf(context))),
              Row(
                children: [
                  Expanded(
                    child: Slider(
                      value: tempRadius,
                      min: 5, max: 100, divisions: 19,
                      label: '${tempRadius.round()} km',
                      activeColor: AppColors.primary,
                      onChanged: (v) => setSheetState(() => tempRadius = v),
                    ),
                  ),
                  SizedBox(
                    width: 50,
                    child: Text('${tempRadius.round()} km',
                      style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textOf(context)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        setSheetState(() { tempRating = 0; tempRadius = 50; });
                      },
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: AppColors.borderOf(context)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        minimumSize: const Size.fromHeight(44),
                      ),
                      child: const Text('Reset'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        setState(() { _minRating = tempRating; _maxRadius = tempRadius; });
                        if (_activeCategory != null) {
                          _loadVendors(_activeCategory!);
                        } else if (_hasSearched) {
                          _loadAllVendors();
                        }
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        minimumSize: const Size.fromHeight(44),
                      ),
                      child: const Text('Apply'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
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
                  GestureDetector(
                    onTap: _showFilterSheet,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: (_minRating > 0 || _maxRadius < 50)
                            ? AppColors.primary.withValues(alpha: 0.2)
                            : AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.tune_rounded, size: 22, color: AppColors.primary),
                    ),
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
                  : !_hasSearched
                      ? _buildInitial()
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

  Widget _buildInitial() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.search_rounded, size: 64, color: AppColors.primary.withValues(alpha: 0.3)),
          const SizedBox(height: 16),
          Text(
            'Search for vendors near you',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textOf(context)),
          ),
          const SizedBox(height: 6),
          Text(
            'Pick a category or type a name to get started',
            style: TextStyle(fontSize: 13, color: AppColors.textMutedOf(context)),
          ),
        ],
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
      baseColor: isDark ? AppColors.darkSurfaceAlt : Colors.grey.shade200,
      highlightColor: isDark ? AppColors.darkBorder : Colors.grey.shade50,
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
