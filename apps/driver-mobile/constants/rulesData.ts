// Path: goviet247/apps/driver-mobile/constants/rulesData.ts

export type RuleSeverity = "INFO" | "WARNING" | "DANGER";

export type RuleBullet = {
  text: string;
  severity?: RuleSeverity;
};

export type RuleSection = {
  id: string;
  title: string;
  summary?: string;
  bullets: RuleBullet[];
};

export type RuleMenuItem = {
  key: "OPERATION" | "BEHAVIOR" | "TERMS";
  title: string;
  description: string;
};

export type AccordionRuleGroup = {
  id: string;
  title: string;
  summary: string;
  severity?: RuleSeverity;
  sections: RuleSection[];
};

export type RuleDocument = {
  key: "OPERATION" | "BEHAVIOR" | "TERMS";
  title: string;
  subtitle: string;
  intro: string;
  sections: RuleSection[];
};

export const RULE_MENU_ITEMS: RuleMenuItem[] = [
  {
    key: "OPERATION",
    title: "Quy chế hoạt động",
    description: "Quy trình vận hành, thanh toán, huỷ chuyến, hỗ trợ và bảo mật.",
  },
  {
    key: "BEHAVIOR",
    title: "Quy tắc ứng xử",
    description: "Các hành vi bị cấm, lỗi thường gặp và mức xử lý vi phạm.",
  },
  {
    key: "TERMS",
    title: "Điều khoản sử dụng",
    description: "Quyền, nghĩa vụ và điều kiện sử dụng ứng dụng tài xế GoViet247.",
  },
];

export const BEHAVIOR_RULE_GROUPS: AccordionRuleGroup[] = [
  {
    id: "serious-violations",
    title: "Vi phạm nghiêm trọng",
    summary:
      "Những hành vi ảnh hưởng trực tiếp đến uy tín hệ thống, quyền lợi khách hàng và an toàn chuyến đi.",
    severity: "DANGER",
    sections: [
      {
        id: "no-offline-deal",
        title: "Không kéo khách ra ngoài ứng dụng",
        bullets: [
          {
            text: "Không được gợi ý khách huỷ đơn trên app để giao dịch riêng bên ngoài.",
            severity: "DANGER",
          },
          {
            text: "Không được xin số điện thoại khách để chào mời các chuyến đi sau ngoài hệ thống.",
            severity: "DANGER",
          },
          {
            text: "Không được thu thêm tiền trái với giá và phụ phí đã được GoViet247 quy định.",
            severity: "DANGER",
          },
        ],
      },
      {
        id: "no-fraud",
        title: "Không gian lận và không giả mạo",
        bullets: [
          {
            text: "Không tạo đơn giả, không khai sai thông tin chuyến đi hoặc thông tin khách hàng.",
            severity: "DANGER",
          },
          {
            text: "Không dùng xe không đúng hồ sơ đã đăng ký với hệ thống.",
            severity: "DANGER",
          },
          {
            text: "Không cho người khác mượn hoặc sử dụng tài khoản tài xế của mình.",
            severity: "DANGER",
          },
        ],
      },
      {
        id: "no-harassment",
        title: "Không xúc phạm, quấy rối hoặc bỏ rơi khách",
        bullets: [
          {
            text: "Không có lời nói, hành vi đe doạ, xúc phạm, gạ gẫm hoặc quấy rối khách hàng.",
            severity: "DANGER",
          },
          {
            text: "Không tự ý yêu cầu khách xuống xe giữa đường nếu không có lý do an toàn hoặc bất khả kháng.",
            severity: "DANGER",
          },
          {
            text: "Không tiết lộ thông tin cá nhân của khách cho bên thứ ba khi chưa được phép.",
            severity: "DANGER",
          },
        ],
      },
    ],
  },
  {
    id: "trip-process",
    title: "Quy trình nhận và thực hiện chuyến",
    summary:
      "Các bước tài xế cần thực hiện để vận hành đúng chuẩn, tránh sai quy trình và tránh phát sinh tranh chấp.",
    severity: "INFO",
    sections: [
      {
        id: "after-accept",
        title: "Sau khi nhận chuyến",
        bullets: [
          {
            text: "Đọc kỹ toàn bộ nội dung đơn hàng, đặc biệt phần ghi chú.",
            severity: "WARNING",
          },
          {
            text: "Liên hệ khách sớm để xác nhận điểm đón, thời gian và các thông tin cần thiết.",
          },
          {
            text: "Nếu có điểm chưa rõ hoặc phát sinh thay đổi lớn, báo admin trước khi thực hiện.",
          },
        ],
      },
      {
        id: "pickup-process",
        title: "Khi đón khách",
        bullets: [
          {
            text: "Đến đúng điểm đón và cố gắng đúng giờ theo thông tin trên app.",
          },
          {
            text: "Xác nhận đúng khách trước khi khởi hành.",
          },
          {
            text: "Theo nội quy công ty, xin phép khách chụp hình hoặc gửi định vị cho admin khi cần xác nhận đón khách.",
            severity: "WARNING",
          },
        ],
      },
      {
        id: "during-trip",
        title: "Trong quá trình di chuyển",
        bullets: [
          {
            text: "Giữ thái độ lịch sự, hỗ trợ khách lên xuống xe và sắp xếp hành lý khi phù hợp.",
          },
          {
            text: "Không tự ý đổi lộ trình, đổi giá hoặc thay đổi nội dung dịch vụ khi chưa thống nhất đúng quy định.",
            severity: "WARNING",
          },
          {
            text: "Nếu có tình huống khẩn cấp, ưu tiên an toàn và liên hệ admin để được hỗ trợ.",
          },
        ],
      },
      {
        id: "dropoff-process",
        title: "Khi trả khách và kết thúc chuyến",
        bullets: [
          {
            text: "Đưa khách đến đúng điểm trả theo nội dung đơn hàng hoặc theo thoả thuận hợp lệ.",
          },
          {
            text: "Theo nội quy công ty, xin phép khách chụp hình hoặc gửi định vị cho admin khi cần xác nhận trả khách.",
            severity: "WARNING",
          },
          {
            text: "Chỉ bấm hoàn thành khi chuyến đi đã thực sự kết thúc.",
          },
        ],
      },
    ],
  },
  {
    id: "safety-service",
    title: "An toàn và thái độ phục vụ",
    summary:
      "Chuẩn phục vụ giúp tăng uy tín tài xế, hạn chế khiếu nại và bảo vệ hình ảnh của GoViet247.",
    severity: "INFO",
    sections: [
      {
        id: "safety",
        title: "An toàn giao thông",
        bullets: [
          {
            text: "Tuân thủ luật giao thông và lái xe trong trạng thái tỉnh táo, đủ điều kiện điều khiển phương tiện.",
            severity: "DANGER",
          },
          {
            text: "Không sử dụng chất kích thích, rượu bia hoặc các hành vi gây nguy hiểm khi làm việc.",
            severity: "DANGER",
          },
          {
            text: "Không dùng điện thoại theo cách làm mất tập trung khi đang lái xe.",
            severity: "WARNING",
          },
        ],
      },
      {
        id: "service-attitude",
        title: "Thái độ phục vụ",
        bullets: [
          {
            text: "Luôn nói chuyện nhẹ nhàng, tôn trọng và có tinh thần hỗ trợ khách.",
          },
          {
            text: "Không tranh cãi, không thách thức, không hành xử thiếu văn hoá với khách.",
            severity: "WARNING",
          },
          {
            text: "Giữ vệ sinh xe và giữ hình ảnh chuyên nghiệp khi làm việc.",
          },
        ],
      },
      {
        id: "data-privacy",
        title: "Bảo mật thông tin",
        bullets: [
          {
            text: "Thông tin khách hàng chỉ được dùng để phục vụ chuyến đi.",
          },
          {
            text: "Không lưu, chia sẻ hoặc sử dụng thông tin khách cho mục đích cá nhân.",
            severity: "DANGER",
          },
        ],
      },
    ],
  },
  {
    id: "common-mistakes",
    title: "Lỗi thường gặp",
    summary:
      "Các lỗi hay gặp không phải lúc nào cũng nghiêm trọng ngay, nhưng lặp lại nhiều lần sẽ ảnh hưởng đến tài khoản.",
    severity: "WARNING",
    sections: [
      {
        id: "note-mistakes",
        title: "Không đọc kỹ đơn hàng",
        bullets: [
          {
            text: "Không đọc ghi chú dẫn đến đón sai nơi, thiếu chuẩn bị hoặc thực hiện sai yêu cầu.",
            severity: "WARNING",
          },
          {
            text: "Không kiểm tra điểm đón, điểm trả, chiều đi hoặc chiều về của chuyến khứ hồi.",
            severity: "WARNING",
          },
        ],
      },
      {
        id: "contact-mistakes",
        title: "Không chủ động liên hệ khách",
        bullets: [
          {
            text: "Không gọi hoặc nhắn khách sau khi nhận chuyến có thể làm khách chờ lâu và phát sinh huỷ chuyến.",
            severity: "WARNING",
          },
          {
            text: "Không báo admin khi không liên hệ được khách hoặc có thay đổi bất thường.",
            severity: "WARNING",
          },
        ],
      },
      {
        id: "cancel-mistakes",
        title: "Huỷ chuyến sai quy định",
        bullets: [
          {
            text: "Không tự ý huỷ chuyến vì lý do chủ quan khi chưa báo admin.",
            severity: "WARNING",
          },
          {
            text: "Một số trường hợp huỷ chuyến có thể bị mất tiền môi giới hoặc bị xử lý theo nội quy.",
            severity: "WARNING",
          },
        ],
      },
    ],
  },
  {
    id: "penalties",
    title: "Xử lý vi phạm",
    summary:
      "GoViet247 có thể áp dụng nhắc nhở, phạt tiền, tạm ngưng hoặc khoá tài khoản tuỳ mức độ vi phạm.",
    severity: "DANGER",
    sections: [
      {
        id: "penalty-levels",
        title: "Các mức xử lý",
        bullets: [
          {
            text: "Nhắc nhở hoặc cảnh báo đối với lỗi nhẹ, lỗi lần đầu chưa gây hậu quả nghiêm trọng.",
            severity: "INFO",
          },
          {
            text: "Phạt tiền hoặc khấu trừ theo chính sách công ty với các lỗi ảnh hưởng đến khách hoặc vận hành.",
            severity: "WARNING",
          },
          {
            text: "Tạm ngưng hoặc khoá tài khoản ngay với các hành vi gian lận, kéo khách ra ngoài, quấy rối hoặc gây mất an toàn.",
            severity: "DANGER",
          },
        ],
      },
      {
        id: "company-rights",
        title: "Quyền của GoViet247",
        bullets: [
          {
            text: "GoViet247 có quyền xem xét lịch sử vi phạm, mức độ ảnh hưởng và tái phạm để quyết định hình thức xử lý.",
          },
          {
            text: "Các trường hợp nghiêm trọng có thể bị khoá tài khoản mà không cần chờ đến lần vi phạm tiếp theo.",
            severity: "DANGER",
          },
        ],
      },
    ],
  },
];

export const OPERATION_DOCUMENT: RuleDocument = {
  key: "OPERATION",
  title: "Quy chế hoạt động",
  subtitle: "Quy trình vận hành cơ bản dành cho tài xế GoViet247",
  intro:
    "Tài liệu này giúp tài xế hiểu cách vận hành trên ứng dụng, quy trình thực hiện chuyến đi, thanh toán, huỷ chuyến và kênh hỗ trợ khi phát sinh sự cố.",
  sections: [
    {
      id: "operation-overview",
      title: "1. Giới thiệu chung",
      bullets: [
        {
          text: "GoViet247 là nền tảng kết nối khách hàng với tài xế để thực hiện các chuyến đi theo thông tin hiển thị trên ứng dụng.",
        },
        {
          text: "Tài xế có trách nhiệm sử dụng tài khoản đúng mục đích, đúng thông tin và tuân thủ nội quy vận hành.",
        },
      ],
    },
    {
      id: "operation-flow",
      title: "2. Quy trình hoạt động",
      bullets: [
        {
          text: "Đăng nhập bằng tài khoản tài xế đã được xác thực và được hệ thống cho phép hoạt động.",
        },
        {
          text: "Đảm bảo ví tài xế, giấy tờ và hồ sơ đang ở trạng thái hợp lệ trước khi nhận chuyến.",
        },
        {
          text: "Khi có chuyến phù hợp, đọc kỹ nội dung và bấm nhận chuyến để bắt đầu phục vụ khách.",
        },
        {
          text: "Thực hiện đầy đủ các bước xác nhận, đón khách, di chuyển và hoàn thành chuyến theo nội quy.",
        },
      ],
    },
    {
      id: "operation-wallet",
      title: "3. Ví tài xế, thanh toán và rút tiền",
      bullets: [
        {
          text: "Tài xế cần duy trì số dư ví theo quy định để hệ thống cho phép nhận chuyến.",
        },
        {
          text: "Thông tin nạp tiền, số tài khoản nhận tiền và hướng dẫn chuyển khoản sẽ được hiển thị trong mục Ví tài xế.",
        },
        {
          text: "Việc rút tiền được xử lý theo chính sách hiện hành của GoViet247 và có thể thay đổi theo từng giai đoạn.",
          severity: "WARNING",
        },
      ],
    },
    {
      id: "operation-cancel",
      title: "4. Huỷ chuyến và hỗ trợ",
      bullets: [
        {
          text: "Khi cần huỷ chuyến hoặc gặp tình huống bất khả kháng, tài xế phải báo admin sớm nhất có thể.",
          severity: "WARNING",
        },
        {
          text: "Không phải mọi trường hợp huỷ chuyến đều được hỗ trợ phí hoặc miễn trách nhiệm.",
          severity: "WARNING",
        },
        {
          text: "Nếu đang trên hành trình, tài xế không tự ý huỷ chuyến mà phải liên hệ admin để được hướng dẫn.",
          severity: "DANGER",
        },
      ],
    },
    {
      id: "operation-complaint",
      title: "5. Khiếu nại, tranh chấp và bảo mật",
      bullets: [
        {
          text: "Mọi phản hồi, khiếu nại hoặc tranh chấp liên quan đến chuyến đi có thể được GoViet247 tiếp nhận và xử lý theo quy trình nội bộ.",
        },
        {
          text: "GoViet247 có quyền lưu trữ các dữ liệu cần thiết phục vụ vận hành, an toàn hệ thống và xử lý tranh chấp.",
        },
        {
          text: "Tài xế có trách nhiệm bảo mật thông tin khách hàng và thông tin tài khoản của mình.",
        },
      ],
    },
  ],
};

export const TERMS_DOCUMENT: RuleDocument = {
  key: "TERMS",
  title: "Điều khoản sử dụng",
  subtitle: "Điều kiện sử dụng ứng dụng dành cho tài xế GoViet247",
  intro:
    "Khi sử dụng ứng dụng GoViet247, tài xế được hiểu là đã đọc, hiểu và đồng ý tuân thủ các điều kiện sử dụng dưới đây.",
  sections: [
    {
      id: "terms-account",
      title: "1. Tài khoản và điều kiện sử dụng",
      bullets: [
        {
          text: "Tài xế phải sử dụng tài khoản chính chủ và chịu trách nhiệm với mọi hoạt động phát sinh từ tài khoản của mình.",
        },
        {
          text: "Không chia sẻ tài khoản, không mạo danh và không sử dụng ứng dụng cho mục đích trái pháp luật.",
          severity: "DANGER",
        },
        {
          text: "GoViet247 có quyền tạm ngưng hoặc khoá tài khoản khi phát hiện dấu hiệu vi phạm hoặc gian lận.",
          severity: "DANGER",
        },
      ],
    },
    {
      id: "terms-driver-duty",
      title: "2. Nghĩa vụ của tài xế",
      bullets: [
        {
          text: "Cung cấp thông tin đúng, đầy đủ và cập nhật khi đăng ký hoặc khi hệ thống yêu cầu.",
        },
        {
          text: "Đảm bảo phương tiện, giấy tờ và điều kiện lái xe phù hợp quy định pháp luật.",
        },
        {
          text: "Tuân thủ hướng dẫn vận hành, quy tắc ứng xử và các chính sách nội bộ do GoViet247 ban hành.",
        },
      ],
    },
    {
      id: "terms-platform-rights",
      title: "3. Quyền của GoViet247",
      bullets: [
        {
          text: "GoViet247 có quyền cập nhật giao diện, tính năng, chính sách và nội dung ứng dụng theo từng thời điểm.",
        },
        {
          text: "GoViet247 có quyền điều tra, đối soát và xử lý các trường hợp bị nghi gian lận, lạm dụng hệ thống hoặc vi phạm nghiêm trọng.",
        },
        {
          text: "GoViet247 không chịu trách nhiệm cho các thiệt hại phát sinh từ việc tài xế vi phạm pháp luật hoặc vi phạm điều khoản sử dụng.",
          severity: "WARNING",
        },
      ],
    },
    {
      id: "terms-privacy",
      title: "4. Bảo mật và dữ liệu",
      bullets: [
        {
          text: "Tài xế đồng ý để GoViet247 xử lý các dữ liệu cần thiết phục vụ đăng nhập, vận hành, hỗ trợ, an toàn và xử lý khiếu nại.",
        },
        {
          text: "Tài xế phải bảo mật mật khẩu, mã xác thực và các thông tin đăng nhập liên quan đến tài khoản.",
        },
        {
          text: "Không được sao chép, phát tán hoặc sử dụng trái phép dữ liệu khách hàng và dữ liệu hệ thống.",
          severity: "DANGER",
        },
      ],
    },
    {
      id: "terms-contact",
      title: "5. Liên hệ và hiệu lực",
      bullets: [
        {
          text: "Khi có thắc mắc hoặc cần hỗ trợ, tài xế liên hệ các kênh hỗ trợ chính thức của GoViet247.",
        },
        {
          text: "Các điều khoản này có thể được cập nhật, và việc tiếp tục sử dụng ứng dụng được xem là tài xế đồng ý với phiên bản cập nhật.",
          severity: "INFO",
        },
      ],
    },
  ],
};