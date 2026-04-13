import 'package:flutter/material.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:shimmer/shimmer.dart';

class VendorServicesScreen extends StatefulWidget {
  const VendorServicesScreen({super.key});

  @override
  State<VendorServicesScreen> createState() => _VendorServicesScreenState();
}

class _VendorServicesScreenState extends State<VendorServicesScreen> {
  final _api = ApiService();
  List<dynamic> _services = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadServices();
  }

  Future<void> _loadServices() async {
    setState(() => _loading = true);
    try {
      final data = await _api.getVendorServices();
      if (mounted) setState(() => _services = data);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Services')),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 80),
        child: FloatingActionButton.extended(
          onPressed: () => _showAddDialog(),
          backgroundColor: AppColors.vendor,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add),
          label: const Text('Add Service'),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadServices,
        child: _loading
          ? _buildLoading()
          : _services.isEmpty
            ? const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.handyman_outlined, size: 48, color: AppColors.textMuted),
                    SizedBox(height: 12),
                    Text('No services yet', style: TextStyle(color: AppColors.textSecondary)),
                    SizedBox(height: 4),
                    Text('Tap + to add your first service', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                  ],
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                itemCount: _services.length,
                itemBuilder: (_, i) => _serviceCard(_services[i]),
              ),
      ),
    );
  }

  Widget _serviceCard(Map<String, dynamic> service) {
    final name = service['name'] ?? 'Service';
    final price = service['price'] ?? service['base_price'] ?? 0;
    final isActive = service['is_active'] ?? service['isActive'] ?? true;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: isActive ? AppColors.vendor.withValues(alpha: 0.1) : AppColors.surfaceAlt,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            Icons.handyman,
            color: isActive ? AppColors.vendor : AppColors.textMuted,
          ),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          '₹${price is num ? price.toStringAsFixed(0) : price}',
          style: TextStyle(
            color: isActive ? AppColors.vendor : AppColors.textMuted,
            fontWeight: FontWeight.w600,
          ),
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (action) {
            if (action == 'edit') _showEditDialog(service);
            if (action == 'delete') _confirmDelete(service);
          },
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'edit', child: Text('Edit')),
            const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: AppColors.error))),
          ],
        ),
      ),
    );
  }

  void _showAddDialog() {
    _showServiceForm(null);
  }

  void _showEditDialog(Map<String, dynamic> service) {
    _showServiceForm(service);
  }

  void _showServiceForm(Map<String, dynamic>? existing) {
    final nameCtrl = TextEditingController(text: existing?['name'] ?? '');
    final priceCtrl = TextEditingController(
      text: existing != null ? '${existing['price'] ?? existing['base_price'] ?? ''}' : '',
    );
    final descCtrl = TextEditingController(text: existing?['description'] ?? '');
    final isEdit = existing != null;
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final bottomInset = MediaQuery.of(ctx).viewInsets.bottom;
          final bottomPadding = MediaQuery.of(ctx).padding.bottom;
          return Padding(
          padding: EdgeInsets.only(bottom: bottomInset),
          child: Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceOf(ctx),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
            // Scrollable form content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Drag handle
                Center(
                  child: Container(
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.borderOf(ctx),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Header
                Row(
                  children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(isEdit ? Icons.edit : Icons.add_circle_outline, color: AppColors.primary, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isEdit ? 'Edit Service' : 'Add New Service',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textOf(ctx)),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isEdit ? 'Update service details' : 'Add a service you offer to customers',
                            style: TextStyle(fontSize: 13, color: AppColors.textSecondaryOf(ctx)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Service name
                Text('Service Name', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textOf(ctx))),
                const SizedBox(height: 8),
                TextField(
                  controller: nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: InputDecoration(
                    hintText: 'e.g. AC Repair, Plumbing',
                    prefixIcon: const Icon(Icons.handyman_outlined, size: 20),
                    filled: true,
                    fillColor: AppColors.surfaceAltOf(ctx),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.borderOf(ctx))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
                const SizedBox(height: 16),

                // Price
                Text('Base Price', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textOf(ctx))),
                const SizedBox(height: 8),
                TextField(
                  controller: priceCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    hintText: '500',
                    prefixIcon: Padding(
                      padding: const EdgeInsets.only(left: 16, right: 8),
                      child: Text('₹', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textOf(ctx))),
                    ),
                    prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
                    filled: true,
                    fillColor: AppColors.surfaceAltOf(ctx),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.borderOf(ctx))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
                const SizedBox(height: 16),

                // Description (optional)
                Text('Description', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textOf(ctx))),
                const SizedBox(height: 4),
                Text('Optional', style: TextStyle(fontSize: 11, color: AppColors.textMutedOf(ctx))),
                const SizedBox(height: 8),
                TextField(
                  controller: descCtrl,
                  maxLines: 2,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    hintText: 'Brief description of the service...',
                    filled: true,
                    fillColor: AppColors.surfaceAltOf(ctx),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.borderOf(ctx))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
              ),
            ),

                // Action buttons — pinned at bottom, always visible
                Padding(
                  padding: EdgeInsets.fromLTRB(24, 12, 24, 16 + bottomPadding),
                  child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          side: BorderSide(color: AppColors.borderOf(ctx)),
                        ),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: FilledButton(
                        onPressed: saving ? null : () async {
                          if (nameCtrl.text.trim().isEmpty) return;
                          setSheetState(() => saving = true);
                          try {
                            if (isEdit) {
                              await _api.updateService('${existing['id']}', {
                                'newPrice': double.tryParse(priceCtrl.text.trim()) ?? 0,
                                'effectiveInDays': 1,
                              });
                            } else {
                              await _api.addService({
                                'name': nameCtrl.text.trim(),
                                'price': double.tryParse(priceCtrl.text.trim()) ?? 0,
                                'description': descCtrl.text.trim(),
                                'availability': 'available',
                              });
                            }
                            if (ctx.mounted) Navigator.pop(ctx);
                            _loadServices();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(isEdit ? 'Service updated' : 'Service added'),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                            }
                          } catch (e) {
                            setSheetState(() => saving = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
                              );
                            }
                          }
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: saving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(isEdit ? 'Save Changes' : 'Add Service'),
                      ),
                    ),
                  ],
                ),
                ),
              ],
            ),
          ),
          );
        },
      ),
    );
  }

  Future<void> _confirmDelete(Map<String, dynamic> service) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Service'),
        content: Text('Remove "${service['name']}"? This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _api.deleteService('${service['id']}');
        _loadServices();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Service deleted')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
          );
        }
      }
    }
  }

  Widget _buildLoading() {
    final isDark = AppColors.isDark(context);
    return Shimmer.fromColors(
      baseColor: isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt,
      highlightColor: isDark ? AppColors.darkBorder : AppColors.surface,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (_, __) => Container(
          height: 72,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: AppColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }
}
