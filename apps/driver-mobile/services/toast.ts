// Path: goviet247/apps/driver-mobile/services/toast.ts
import Toast from "react-native-toast-message";

export function showSuccess(message: string) {
  Toast.show({
    type: "success",
    text1: "Thành công",
    text2: message,
    visibilityTime: 2000,
  });
}

export function showError(message: string) {
  Toast.show({
    type: "error",
    text1: "Lỗi",
    text2: message,
    visibilityTime: 2500,
  });
}