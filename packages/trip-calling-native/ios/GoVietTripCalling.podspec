Pod::Spec.new do |s|
  s.name = 'GoVietTripCalling'
  s.version = '0.1.0'
  s.summary = 'Private GoViet247 trip audio calls'
  s.description = 'PushKit, CallKit and Amazon Chime SDK audio integration.'
  s.license = { :type => 'Proprietary' }
  s.author = 'GoViet247'
  s.homepage = 'https://goviet247.com'
  s.platform = :ios, '15.1'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'AmazonChimeSDK', '0.27.4'
  s.source_files = '**/*.swift'
  s.swift_version = '5.0'
end
