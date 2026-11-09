# Namaz Dostu — Widget uzantısını Xcode projesine ekler (Codemagic derlemesinde çalışır).
# Tekrar çalıştırılırsa bir şey bozmaz (hedef varsa atlar).
require 'xcodeproj'

PROJE = 'Huzur Vakti.xcodeproj'
ANA = 'Huzur Vakti'
UZANTI = 'NamazDostuWidget'
ANA_ID = 'com.huzurvakti.namazvakitleri'

proje = Xcodeproj::Project.open(PROJE)
ana = proje.targets.find { |t| t.name == ANA } or abort("Ana hedef yok")

# 1) Ana uygulamaya WidgetBridge.swift
unless ana.source_build_phase.files_references.any? { |f| f && f.path && f.path.end_with?('WidgetBridge.swift') }
  ref = proje.main_group.new_reference("#{ANA}/WidgetBridge.swift")
  ana.source_build_phase.add_file_reference(ref)
  puts '+ WidgetBridge.swift ana hedefe eklendi'
end

if proje.targets.any? { |t| t.name == UZANTI }
  puts 'Widget hedefi zaten var'
  proje.save
  exit 0
end

# 2) Uzantı hedefi
uz = proje.new_target(:app_extension, UZANTI, :ios, '16.0', proje.products_group, :swift)
grup = proje.main_group.new_group(UZANTI, UZANTI)
swift = grup.new_reference('NamazDostuWidget.swift')
varliklar = grup.new_reference('Assets.xcassets')
grup.new_reference('Info.plist')
grup.new_reference('NamazDostuWidget.entitlements')
uz.source_build_phase.add_file_reference(swift)
uz.resources_build_phase.add_file_reference(varliklar)

['WidgetKit', 'SwiftUI'].each do |fw|
  uz.add_system_framework(fw)
end

uz.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = "#{ANA_ID}.widget"
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = "#{UZANTI}/Info.plist"
  s['CODE_SIGN_ENTITLEMENTS'] = "#{UZANTI}/NamazDostuWidget.entitlements"
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['SUPPORTS_MACCATALYST'] = 'NO'
  s['SKIP_INSTALL'] = 'YES'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['MARKETING_VERSION'] = '1.9'
  s['CURRENT_PROJECT_VERSION'] = '19'
  s['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = ''
  s['ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME'] = ''
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  s['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
end

# 3) Ana uygulamaya göm + bağımlılık
ana.add_dependency(uz)
gom = ana.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' || p.name == 'Embed App Extensions' }
unless gom
  gom = ana.new_copy_files_build_phase('Embed Foundation Extensions')
  gom.symbol_dst_subfolder_spec = :plug_ins
end
bf = gom.add_file_reference(uz.product_reference, true)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

proje.save
puts '+ NamazDostuWidget hedefi eklendi ve uygulamaya gömüldü'
