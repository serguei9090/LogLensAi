/// Port of `src/store/uiStore.ts` (`useUIStore`). Not RPC-backed — pure
/// local UI state (column visibility/order/widths, sidebar collapse state).
/// The TS store persists to localStorage via zustand's `persist` middleware
/// under key `loglensai-ui-state`; persistence is left as a follow-up here
/// (e.g. via `shared_preferences`) since it's not required for the
/// providers to compile/bind correctly.
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/ui_column.dart";

class UiState {
  const UiState({
    this.sidebarCollapsed = false,
    this.facetSidebarCollapsed = true,
    this.columnManagerCollapsed = true,
    this.visibleColumns = const {
      "id": true,
      "timestamp": true,
      "ingest_timestamp": false,
      "level": true,
      "message": true,
      "cluster_id": true,
      "actions": true,
      "http_method": false,
      "http_status": false,
    },
    this.customColumns = CustomColumnDef.defaults,
    this.columnOrder = const [
      "id",
      "timestamp",
      "ingest_timestamp",
      "level",
      "http_method",
      "http_status",
      "message",
      "cluster_id",
      "actions",
    ],
    this.columnWidths = const {
      "id": "80px",
      "timestamp": "180px",
      "ingest_timestamp": "180px",
      "level": "90px",
      "http_method": "80px",
      "http_status": "72px",
      "message": "1fr",
      "cluster_id": "110px",
      "actions": "100px",
    },
  });

  final bool sidebarCollapsed;
  final bool facetSidebarCollapsed;
  final bool columnManagerCollapsed;
  final Map<String, bool> visibleColumns;
  final List<CustomColumnDef> customColumns;
  final List<String> columnOrder;
  final Map<String, String> columnWidths;

  UiState copyWith({
    bool? sidebarCollapsed,
    bool? facetSidebarCollapsed,
    bool? columnManagerCollapsed,
    Map<String, bool>? visibleColumns,
    List<CustomColumnDef>? customColumns,
    List<String>? columnOrder,
    Map<String, String>? columnWidths,
  }) {
    return UiState(
      sidebarCollapsed: sidebarCollapsed ?? this.sidebarCollapsed,
      facetSidebarCollapsed: facetSidebarCollapsed ?? this.facetSidebarCollapsed,
      columnManagerCollapsed: columnManagerCollapsed ?? this.columnManagerCollapsed,
      visibleColumns: visibleColumns ?? this.visibleColumns,
      customColumns: customColumns ?? this.customColumns,
      columnOrder: columnOrder ?? this.columnOrder,
      columnWidths: columnWidths ?? this.columnWidths,
    );
  }
}

class UiNotifier extends StateNotifier<UiState> {
  UiNotifier() : super(const UiState());

  void toggleSidebar() => state = state.copyWith(sidebarCollapsed: !state.sidebarCollapsed);

  void setSidebarCollapsed(bool collapsed) =>
      state = state.copyWith(sidebarCollapsed: collapsed);

  void toggleFacetSidebar() {
    final next = !state.facetSidebarCollapsed;
    state = state.copyWith(
      facetSidebarCollapsed: next,
      columnManagerCollapsed: next ? state.columnManagerCollapsed : true,
    );
  }

  void setFacetSidebarCollapsed(bool collapsed) {
    state = state.copyWith(
      facetSidebarCollapsed: collapsed,
      columnManagerCollapsed: collapsed ? state.columnManagerCollapsed : true,
    );
  }

  void toggleColumnManager() {
    final next = !state.columnManagerCollapsed;
    state = state.copyWith(
      columnManagerCollapsed: next,
      facetSidebarCollapsed: next ? state.facetSidebarCollapsed : true,
    );
  }

  void setColumnManagerCollapsed(bool collapsed) {
    state = state.copyWith(
      columnManagerCollapsed: collapsed,
      facetSidebarCollapsed: collapsed ? state.facetSidebarCollapsed : true,
    );
  }

  void toggleColumnVisibility(String colName) {
    final next = Map<String, bool>.from(state.visibleColumns);
    next[colName] = !(next[colName] ?? false);
    state = state.copyWith(visibleColumns: next);
  }

  void setColumnVisibility(String colName, bool visible) {
    final next = Map<String, bool>.from(state.visibleColumns);
    next[colName] = visible;
    state = state.copyWith(visibleColumns: next);
  }

  void addCustomColumn(CustomColumnDef col) {
    final order = List<String>.from(state.columnOrder);
    final idx = order.indexOf("message");
    if (idx == -1) {
      order.add(col.id);
    } else {
      order.insert(idx, col.id);
    }
    state = state.copyWith(
      customColumns: [...state.customColumns, col],
      columnOrder: order,
      columnWidths: {...state.columnWidths, col.id: col.width},
      visibleColumns: {...state.visibleColumns, col.id: true},
    );
  }

  void removeCustomColumn(String id) {
    final visibleColumns = Map<String, bool>.from(state.visibleColumns)..remove(id);
    final columnWidths = Map<String, String>.from(state.columnWidths)..remove(id);
    state = state.copyWith(
      customColumns: state.customColumns.where((c) => c.id != id).toList(),
      columnOrder: state.columnOrder.where((c) => c != id).toList(),
      columnWidths: columnWidths,
      visibleColumns: visibleColumns,
    );
  }

  void setColumnOrder(List<String> order) => state = state.copyWith(columnOrder: order);

  void setColumnWidth(String id, String width) {
    state = state.copyWith(columnWidths: {...state.columnWidths, id: width});
  }
}

final uiProvider = StateNotifierProvider<UiNotifier, UiState>((ref) => UiNotifier());
