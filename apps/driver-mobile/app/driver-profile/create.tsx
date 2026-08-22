// Path: goviet247/apps/driver-mobile/app/driver-profile/create.tsx
import { useMemo, useState } from "react";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { getDriverToken, removeDriverToken } from "../../services/storage";
import {
  createDriverProfile,
  type DriverDocumentType,
  uploadDriverDocument,
} from "../../services/driverProfileApi";

type DocumentItem = {
  type: DriverDocumentType;
  label: string;
};

type UploadedDocState = {
  localUri: string;
  fileUrl: string;
};

const VEHICLE_TYPES = [
  { label: "Xe 5 chỗ", value: "CAR_5" },
  { label: "Xe 7 chỗ", value: "CAR_7" },
  { label: "Xe 16 chỗ", value: "CAR_16" },
] as const;

const DOCUMENT_ITEMS: DocumentItem[] = [
  { type: "CCCD_FRONT", label: "CCCD mặt trước" },
  { type: "CCCD_BACK", label: "CCCD mặt sau" },
  { type: "PORTRAIT", label: "Ảnh chân dung" },
  { type: "DRIVER_LICENSE", label: "Bằng lái xe" },
  {
    type: "VEHICLE_REGISTRATION",
    label: "Cavet xe / giấy tờ tương đương",
  },
];

export default function DriverProfileCreateScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [plateNumber, setPlateNumber] = useState("");

  const [errorText, setErrorText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState<DriverDocumentType | null>(
    null,
  );

  const [uploadedDocs, setUploadedDocs] = useState<
    Partial<Record<DriverDocumentType, UploadedDocState>>
  >({});

  const [contractModalVisible, setContractModalVisible] = useState(false);
  const [contractCheckedInModal, setContractCheckedInModal] = useState(false);
  const [hasAcceptedContract, setHasAcceptedContract] = useState(false);

  const allDocsUploaded = useMemo(() => {
    return DOCUMENT_ITEMS.every((item) => !!uploadedDocs[item.type]?.fileUrl);
  }, [uploadedDocs]);

  const isFormValid = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      vehicleType.trim().length > 0 &&
      vehicleBrand.trim().length > 0 &&
      vehicleModel.trim().length > 0 &&
      vehicleYear.trim().length > 0 &&
      plateNumber.trim().length > 0 &&
      allDocsUploaded
    );
  }, [
    fullName,
    vehicleType,
    vehicleBrand,
    vehicleModel,
    vehicleYear,
    plateNumber,
    allDocsUploaded,
  ]);

  const canSubmit = useMemo(() => {
    return isFormValid && hasAcceptedContract && !submitting && !uploadingType;
  }, [isFormValid, hasAcceptedContract, submitting, uploadingType]);

  const chooseDocumentSource = (docType: DriverDocumentType) => {
    if (Platform.OS === "web") {
      pickFromLibrary(docType);
      return;
    }

    Alert.alert("Chọn ảnh", "Bạn muốn lấy ảnh theo cách nào?", [
      {
        text: "Chụp ảnh",
        onPress: () => pickFromCamera(docType),
      },
      {
        text: "Chọn từ thư viện",
        onPress: () => pickFromLibrary(docType),
      },
      {
        text: "Huỷ",
        style: "cancel",
      },
    ]);
  };

  const pickFromCamera = async (docType: DriverDocumentType) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setErrorText("Bạn chưa cấp quyền camera.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      await handleUploadDocument(docType, result.assets[0]);
    } catch (error: any) {
      setErrorText(error?.message || "Không mở được camera.");
    }
  };

  const pickFromLibrary = async (docType: DriverDocumentType) => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setErrorText("Bạn chưa cấp quyền thư viện ảnh.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      await handleUploadDocument(docType, result.assets[0]);
    } catch (error: any) {
      setErrorText(error?.message || "Không chọn được ảnh từ thư viện.");
    }
  };

  const handleUploadDocument = async (
    docType: DriverDocumentType,
    asset: ImagePicker.ImagePickerAsset,
  ) => {
    try {
      setUploadingType(docType);
      setErrorText("");

      const token = await getDriverToken();

      if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }

      const data = await uploadDriverDocument(token, docType, asset);

      setUploadedDocs((prev) => ({
        ...prev,
        [docType]: {
          localUri: asset.uri,
          fileUrl: data.document.fileUrl,
        },
      }));
    } catch (error: any) {
      setErrorText(error?.message || "Upload ảnh thất bại.");
    } finally {
      setUploadingType(null);
    }
  };

  const openContractModal = () => {
    setContractCheckedInModal(hasAcceptedContract);
    setContractModalVisible(true);
  };

  const closeContractModal = () => {
    setContractModalVisible(false);
  };

  const confirmContractAcceptance = () => {
    if (!contractCheckedInModal) {
      setErrorText("Vui lòng xác nhận bạn đã đọc và đồng ý hợp đồng.");
      return;
    }

    setHasAcceptedContract(true);
    setErrorText("");
    setContractModalVisible(false);
  };

  const handleBackToLogin = async () => {
    try {
      setErrorText("");
      await removeDriverToken();
    } catch (error) {
      console.warn("handleBackToLogin remove token error:", error);
    } finally {
      router.replace("/");
    }
  };

  const handleSubmit = async () => {
    const yearNumber = Number(vehicleYear.trim());

    if (!fullName.trim()) {
      setErrorText("Vui lòng nhập họ và tên.");
      return;
    }

    if (!vehicleType.trim()) {
      setErrorText("Vui lòng chọn loại xe.");
      return;
    }

    if (!vehicleBrand.trim()) {
      setErrorText("Vui lòng nhập hãng xe.");
      return;
    }

    if (!vehicleModel.trim()) {
      setErrorText("Vui lòng nhập dòng xe.");
      return;
    }

    if (!vehicleYear.trim() || Number.isNaN(yearNumber)) {
      setErrorText("Vui lòng nhập năm xe hợp lệ.");
      return;
    }

    if (!plateNumber.trim()) {
      setErrorText("Vui lòng nhập biển số xe.");
      return;
    }

    if (!allDocsUploaded) {
      setErrorText("Vui lòng tải lên đầy đủ 5 ảnh giấy tờ.");
      return;
    }

    if (!hasAcceptedContract) {
      setErrorText("Vui lòng đọc và đồng ý hợp đồng trước khi gửi hồ sơ.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorText("");

      const token = await getDriverToken();

      if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }

      await createDriverProfile(token, {
        fullName: fullName.trim(),
        vehicleType: vehicleType,
        vehicleBrand: vehicleBrand.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear: yearNumber,
        plateNumber: plateNumber.trim().toUpperCase(),

        documents: {
          CCCD_FRONT: uploadedDocs.CCCD_FRONT!.fileUrl,
          CCCD_BACK: uploadedDocs.CCCD_BACK!.fileUrl,
          PORTRAIT: uploadedDocs.PORTRAIT!.fileUrl,
          DRIVER_LICENSE: uploadedDocs.DRIVER_LICENSE!.fileUrl,
          VEHICLE_REGISTRATION: uploadedDocs.VEHICLE_REGISTRATION!.fileUrl,
        },

        contractAccepted: true,
        contractCode: "GOVIET247_DRIVER_PARTNERSHIP",
        contractTitle: "Hợp đồng hợp tác tài xế GoViet247",
        contractVersion: "v1.0",
        contractAppVersion: "driver-mobile-web-dev",
      });

      router.replace("/driver-profile/pending");
    } catch (error: any) {
      setErrorText(error?.message || "Gửi hồ sơ tài xế thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(insets.bottom + 120, 140),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.topBackButton}
                onPress={handleBackToLogin}
                activeOpacity={0.85}
              >
                <Text style={styles.topBackButtonText}>←</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>Hoàn thiện hồ sơ tài xế</Text>
            <Text style={styles.subtitle}>
              Vui lòng nhập thông tin xe và tải đầy đủ giấy tờ để gửi admin
              duyệt.
            </Text>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Thông tin cá nhân & xe</Text>

              <Text style={styles.label}>Họ và tên</Text>
              <TextInput
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (errorText) setErrorText("");
                }}
                placeholder="Ví dụ: Nguyễn Văn A"
                style={styles.input}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Loại xe</Text>
              <View style={styles.vehicleTypeRow}>
                {VEHICLE_TYPES.map((item, index) => {
                  const isActive = vehicleType === item.value;

                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.vehicleTypeButton,
                        isActive && styles.vehicleTypeButtonActive,
                        index !== VEHICLE_TYPES.length - 1 &&
                          styles.vehicleTypeGap,
                      ]}
                      onPress={() => {
                        setVehicleType(item.value);
                        if (errorText) setErrorText("");
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.vehicleTypeButtonText,
                          isActive && styles.vehicleTypeButtonTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Hãng xe</Text>
              <TextInput
                value={vehicleBrand}
                onChangeText={(text) => {
                  setVehicleBrand(text);
                  if (errorText) setErrorText("");
                }}
                placeholder="Ví dụ: Toyota"
                style={styles.input}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Dòng xe</Text>
              <TextInput
                value={vehicleModel}
                onChangeText={(text) => {
                  setVehicleModel(text);
                  if (errorText) setErrorText("");
                }}
                placeholder="Ví dụ: Innova"
                style={styles.input}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Năm đăng ký xe</Text>
              <TextInput
                value={vehicleYear}
                onChangeText={(text) => {
                  const onlyDigits = text.replace(/\D/g, "").slice(0, 4);
                  setVehicleYear(onlyDigits);
                  if (errorText) setErrorText("");
                }}
                placeholder="Ví dụ: 2020"
                keyboardType="number-pad"
                style={styles.input}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Biển số xe</Text>
              <TextInput
                value={plateNumber}
                onChangeText={(text) => {
                  setPlateNumber(text);
                  if (errorText) setErrorText("");
                }}
                placeholder="Ví dụ: 51H12345"
                style={styles.input}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Giấy tờ bắt buộc</Text>
              <Text style={styles.sectionHint}>
                Hỗ trợ ảnh JPG, JPEG, PNG, WEBP. Dung lượng tối đa 5MB/ảnh.
              </Text>

              {DOCUMENT_ITEMS.map((item) => {
                const uploaded = uploadedDocs[item.type];
                const isUploading = uploadingType === item.type;

                return (
                  <View key={item.type} style={styles.docItem}>
                    <Text style={styles.docLabel}>{item.label}</Text>

                    {uploaded?.localUri ? (
                      <Image
                        source={{ uri: uploaded.localUri }}
                        style={styles.previewImage}
                      />
                    ) : (
                      <View style={styles.previewPlaceholder}>
                        <Text style={styles.previewPlaceholderText}>
                          Chưa có ảnh
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.docButton,
                        isUploading && styles.docButtonDisabled,
                      ]}
                      onPress={() => chooseDocumentSource(item.type)}
                      disabled={isUploading || submitting}
                      activeOpacity={0.85}
                    >
                      {isUploading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.docButtonText}>
                          {uploaded?.fileUrl
                            ? "Chụp / chọn lại ảnh"
                            : "Chụp / chọn ảnh"}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {uploaded?.fileUrl ? (
                      <Text style={styles.uploadedText}>
                        Đã tải lên thành công
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.contractCard}>
              <Text style={styles.sectionTitle}>Hợp đồng hợp tác tài xế</Text>

              <Text style={styles.contractDescription}>
                Vui lòng đọc kỹ hợp đồng hợp tác tài xế trước khi gửi hồ sơ. Bạn
                chỉ có thể gửi hồ sơ khi đã xác nhận đồng ý với các điều khoản.
              </Text>

              <View style={styles.contractStatusRow}>
                <View
                  style={[
                    styles.contractStatusBadge,
                    hasAcceptedContract
                      ? styles.contractStatusBadgeAccepted
                      : styles.contractStatusBadgePending,
                  ]}
                >
                  <Text
                    style={[
                      styles.contractStatusText,
                      hasAcceptedContract
                        ? styles.contractStatusTextAccepted
                        : styles.contractStatusTextPending,
                    ]}
                  >
                    {hasAcceptedContract
                      ? "Đã đồng ý hợp đồng"
                      : "Chưa đồng ý hợp đồng"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.contractButton}
                onPress={openContractModal}
                activeOpacity={0.85}
              >
                <Text style={styles.contractButtonText}>
                  {hasAcceptedContract ? "Xem lại hợp đồng" : "Xem hợp đồng"}
                </Text>
              </TouchableOpacity>
            </View>

            {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

            <TouchableOpacity
              style={[
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Gửi hồ sơ tài xế</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={contractModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeContractModal}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalCard} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalHeaderSide}
                onPress={closeContractModal}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBackText}>←</Text>
              </TouchableOpacity>

              <Text style={styles.modalHeaderTitle}>
                Hợp đồng hợp tác tài xế
              </Text>

              <View style={styles.modalHeaderSide} />
            </View>

            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.modalContentInner}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.contractParagraph}>
                Bằng việc tham gia nền tảng GoViet247, tài xế xác nhận đã đọc,
                hiểu và đồng ý hợp tác với vai trò đối tác vận hành độc lập.
              </Text>

              <Text style={styles.contractParagraph}>
                Tài xế cam kết cung cấp thông tin cá nhân, thông tin phương tiện
                và giấy tờ hợp lệ, trung thực, còn hiệu lực. Mọi hành vi cung
                cấp thông tin sai lệch có thể dẫn đến từ chối hồ sơ hoặc khóa
                tài khoản.
              </Text>

              <Text style={styles.contractParagraph}>
                Tài xế hiểu rằng GoViet247 là nền tảng kết nối chuyến đi. Tài xế
                có trách nhiệm thực hiện chuyến đúng thông tin đã nhận, liên hệ
                khách lịch sự, đón đúng giờ và tuân thủ quy định vận hành của hệ
                thống.
              </Text>

              <Text style={styles.contractParagraph}>
                Tài xế đồng ý rằng các khoản hoa hồng, khoản giữ lại, nghĩa vụ
                phí hoặc nghĩa vụ vận hành khác sẽ được áp dụng theo cấu hình và
                chính sách hiện hành của hệ thống tại từng thời điểm.
              </Text>

              <Text style={styles.contractParagraph}>
                Tài xế hiểu và đồng ý rằng mọi nghĩa vụ thuế phát sinh từ thu
                nhập cá nhân là trách nhiệm của tài xế theo quy định pháp luật.
                Hệ thống GoViet247 có thể hỗ trợ tính toán, tạm giữ hoặc khấu
                trừ các khoản liên quan đến thuế trực tiếp từ ví tài xế để hỗ
                trợ việc thực hiện nghĩa vụ này.
              </Text>

              <Text style={styles.contractParagraph}>
                Tài xế đồng ý rằng các khoản hoa hồng, phí hoặc nghĩa vụ tài
                chính có thể được trừ trực tiếp vào số dư ví tài xế trên hệ
                thống.
              </Text>

              <Text style={styles.contractParagraph}>
                Tài xế cam kết bảo mật thông tin khách hàng, không sử dụng dữ
                liệu chuyến đi sai mục đích, không tự ý thu thêm khoản ngoài
                thỏa thuận nếu không có xác nhận hợp lệ từ hệ thống hoặc khách
                hàng.
              </Text>

              <Text style={styles.contractParagraph}>
                GoViet247 không đảm bảo số lượng chuyến đi, thu nhập hoặc tần
                suất hoạt động cho tài xế. Việc nhận chuyến phụ thuộc vào nhu
                cầu thị trường và sự chủ động của tài xế.
              </Text>

              <Text style={styles.contractParagraph}>
                GoViet247 có quyền xem xét, tạm ngưng hoặc chấm dứt quyền hoạt
                động của tài xế nếu phát hiện vi phạm quy định, có hành vi gian
                lận, ảnh hưởng xấu đến khách hàng hoặc ảnh hưởng đến uy tín nền
                tảng.
              </Text>

              <Text style={styles.contractParagraph}>
                GoViet247 có quyền cập nhật, thay đổi chính sách, mức phí hoặc
                quy định vận hành theo từng thời điểm mà không cần ký lại hợp
                đồng, và sẽ được thông báo thông qua hệ thống.
              </Text>

              <Text style={styles.contractParagraph}>
                Khi bấm xác nhận, tài xế đồng ý rằng đây là sự chấp thuận điện
                tử có giá trị dùng để hoàn tất bước đăng ký hồ sơ tài xế trên hệ
                thống.
              </Text>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setContractCheckedInModal((prev) => !prev)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    contractCheckedInModal && styles.checkboxBoxChecked,
                  ]}
                >
                  {contractCheckedInModal ? (
                    <Text style={styles.checkboxTick}>✓</Text>
                  ) : null}
                </View>

                <Text style={styles.checkboxText}>
                  Tôi đã đọc kỹ và đồng ý với hợp đồng hợp tác tài xế.
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={closeContractModal}
                activeOpacity={0.85}
              >
                <Text style={styles.modalSecondaryButtonText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalPrimaryButton,
                  !contractCheckedInModal && styles.modalPrimaryButtonDisabled,
                ]}
                onPress={confirmContractAcceptance}
                activeOpacity={0.85}
                disabled={!contractCheckedInModal}
              >
                <Text style={styles.modalPrimaryButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  container: {
    flex: 1,
  },
  topBar: {
    marginBottom: 8,
    alignItems: "flex-start",
  },
  topBackButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  topBackButtonText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 24,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    marginBottom: 14,
  },
  vehicleTypeRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  vehicleTypeButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  vehicleTypeGap: {
    marginRight: 8,
  },
  vehicleTypeButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  vehicleTypeButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
  },
  vehicleTypeButtonTextActive: {
    color: "#FFFFFF",
  },
  docItem: {
    marginBottom: 18,
  },
  docLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: "#E5E7EB",
  },
  previewPlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  previewPlaceholderText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  docButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  docButtonDisabled: {
    opacity: 0.7,
  },
  docButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  uploadedText: {
    marginTop: 8,
    color: "#059669",
    fontSize: 13,
    fontWeight: "600",
  },
  contractCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  contractDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
    marginBottom: 14,
  },
  contractStatusRow: {
    marginBottom: 14,
  },
  contractStatusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  contractStatusBadgeAccepted: {
    backgroundColor: "#DCFCE7",
  },
  contractStatusBadgePending: {
    backgroundColor: "#FEF3C7",
  },
  contractStatusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  contractStatusTextAccepted: {
    color: "#166534",
  },
  contractStatusTextPending: {
    color: "#92400E",
  },
  contractButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  contractButtonText: {
    color: "#1D4ED8",
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    marginBottom: 14,
    textAlign: "center",
  },
  submitButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
  },
  modalCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    height: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  modalHeaderSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  modalBackText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },

  modalHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },

  modalContent: {
    flex: 1,
  },

  modalContentInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  modalFooter: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },

  modalSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  modalSecondaryButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
  },

  modalPrimaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  modalPrimaryButtonDisabled: {
    opacity: 0.55,
  },

  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 14,
  },
  contractParagraph: {
    fontSize: 14,
    lineHeight: 22,
    color: "#374151",
    marginBottom: 14,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#9CA3AF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  checkboxTick: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
    fontWeight: "600",
  },
});
