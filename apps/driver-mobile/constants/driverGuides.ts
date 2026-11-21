// Driver guidance, including notices archived from the screenshots supplied on 29/10/2026.
// Current acceptance and contact guidance is maintained here alongside those notices.
import { CONTACT_AFTER_ACCEPT, CONTACT_AFTER_ACCEPT_PARAGRAPHS } from "./tripAcceptanceRules";

export const DRIVER_GUIDES = [
  {
    "id": "accept-troubleshooting",
    "title": "Không nhận được chuyến: thông báo và cách xử lý",
    "summary": "Tra cứu thông báo, tự xử lý và biết khi nào cần liên hệ Support.",
    "sections": [
      {
        "title": "1. Khi nào được xem là nhận chuyến thành công?",
        "paragraphs": [
          "Chuyến chỉ được giao khi hệ thống xác nhận nhận chuyến thành công. Nhìn thấy chuyến, nhận thông báo chuyến mới hoặc đã bấm “Nhận chuyến” không có nghĩa chuyến đã được giữ cho mình.",
          "Nếu chưa rõ kết quả, kiểm tra Đơn của tôi và làm mới dữ liệu trước khi thử lại. Nếu chuyến đã nằm trong Đơn của tôi, hãy thực hiện quy trình liên hệ ngay sau khi nhận chuyến."
        ]
      },
      {
        "title": "2. Tài xế khác đã nhận, chuyến bị huỷ hoặc không còn mở nhận",
        "paragraphs": [
          "“Chuyến này đã được tài xế khác nhận trước…”: yêu cầu hợp lệ của tài xế khác đã được hệ thống ghi nhận trước. Anh/chị chọn chuyến khác; không cần nhắn Support chỉ vì bấm nhận không kịp.",
          "“Chuyến này đã bị huỷ…”, “Chuyến này không còn trong danh sách…” hoặc “Chuyến này hiện không còn mở nhận…”: làm mới danh sách và chọn chuyến khác. Chuyến không còn sẵn sàng để nhận.",
          "“Chuyến này hiện không còn mở nhận cho tài khoản của anh/chị…”: phạm vi tài xế được nhận chuyến đã thay đổi. Tải lại danh sách hoặc chọn chuyến khác.",
          "“Chuyến này chưa được Admin duyệt mở nhận…”: chờ danh sách cập nhật hoặc chọn chuyến khác. Không cần bấm liên tục hay nhắn Support yêu cầu mở lại chuyến.",
          "Nếu chuyến tự biến mất, kiểm tra Đơn của tôi trước. Nếu không có, làm mới danh sách; chuyến có thể đã được nhận, bị huỷ hoặc ngừng mở nhận. Không cần nhắn Support để xin lại chuyến chỉ vì chuyến đã hết."
        ]
      },
      {
        "title": "3. Chưa hết đếm ngược hoặc đang xử lý",
        "paragraphs": [
          "“Nhận sau …s”, “Mở nhận chuyến sau …s” hoặc “Chuyến chưa mở nhận…”: chờ hết đếm ngược rồi mới bấm nhận. Nút chưa mở là trạng thái bình thường, không cần báo Support.",
          "“Đang nhận…”: ứng dụng đang xử lý yêu cầu, vui lòng chờ và không bấm liên tục. Nếu chờ lâu hoặc mất mạng, kiểm tra Đơn của tôi trước khi thử lại."
        ]
      },
      {
        "title": "4. Đã nhận chuyến hoặc đủ số chuyến đang nhận",
        "paragraphs": [
          "“Anh/chị đã nhận chuyến này…”: vào Đơn của tôi để xem và liên hệ xác nhận; không cần bấm nhận lại.",
          "“Anh/chị đang có đủ … chuyến chưa hoàn thành…”: đã đạt giới hạn số chuyến đang nhận. Chỉ cập nhật hoàn thành khi chuyến thực tế đã hoàn thành; không đánh dấu hoàn thành sớm để nhận thêm chuyến."
        ]
      },
      {
        "title": "5. Số dư ví không đủ",
        "paragraphs": [
          "“Ví còn …đ, chuyến này cần …đ. Anh/chị cần nạp thêm …đ…” hoặc “Số dư ví không đủ…”: nạp đủ số tiền còn thiếu theo hướng dẫn tại Ví tài xế, chờ tiền được cộng vào ví rồi kiểm tra chuyến còn mở nhận hay không.",
          "Chuyển khoản chưa đồng nghĩa tiền đã được cộng vào ví, và nạp tiền không giữ chỗ cho chuyến. Nếu đã chuyển khoản nhưng ví chưa cập nhật, gửi biên lai cho Support để được kiểm tra."
        ]
      },
      {
        "title": "6. Chuyến vừa thay đổi hoặc chưa xác nhận được kết quả",
        "paragraphs": [
          "“Chuyến vừa thay đổi…”: kiểm tra Đơn của tôi và tải lại danh sách trước khi thử lại. Chỉ thử nhận lại khi chuyến vẫn mở nhận và chưa nằm trong Đơn của tôi.",
          "“Chưa xác nhận được kết quả nhận chuyến…”: có thể kết nối mạng bị gián đoạn hoặc hết thời gian chờ. Kiểm tra mạng rồi làm mới Đơn của tôi trước khi bấm lại; thông báo này chưa khẳng định nhận chuyến thất bại.",
          "Nếu ví đã bị trừ nhưng không thấy chuyến trong Đơn của tôi sau khi làm mới, liên hệ Support ngay để kiểm tra, không tiếp tục bấm nhận nhiều lần."
        ]
      },
      {
        "title": "7. Cần đăng nhập lại hoặc xác nhận hợp đồng",
        "paragraphs": [
          "“Phiên đăng nhập đã hết hạn…”: đăng nhập lại, kiểm tra Đơn của tôi rồi mới tiếp tục xem chuyến đang chờ.",
          "Nếu ứng dụng chuyển tới “Hợp đồng tài xế”, vui lòng đọc và thực hiện bước xác nhận theo hướng dẫn trên màn hình trước khi tiếp tục nhận chuyến."
        ]
      },
      {
        "title": "8. Khi nào cần liên hệ Support?",
        "paragraphs": [
          "Nếu thấy “Bạn không thể nhận chuyến này. Vui lòng liên hệ Zalo team support GoViet247 để được hỗ trợ.”, hãy liên hệ Support để được kiểm tra; không cần tự đoán nguyên nhân hoặc bấm nhận liên tục.",
          "Cũng cần báo Support khi ví đã bị trừ nhưng không có chuyến trong Đơn của tôi sau khi làm mới; đã chuyển khoản nạp ví nhưng chưa được cộng; hoặc lỗi lặp lại sau khi đã kiểm tra mạng, làm mới và thực hiện đúng hướng dẫn.",
          "Nếu đang dùng app mà thấy thông báo “Chưa tìm thấy hồ sơ tài xế…” hoặc “Hồ sơ tài xế chưa ở trạng thái được phép nhận chuyến…”, kiểm tra Hồ sơ tài xế và liên hệ Support nếu thông tin không đúng với tình trạng tài khoản của mình.",
          "Khi báo lỗi, gửi mã chuyến (nếu có), số điện thoại đăng ký, ảnh chụp thông báo và thời điểm xảy ra. Với vấn đề nạp ví, gửi thêm biên lai chuyển khoản. Có thể nhắn hỗ trợ trong app hoặc Zalo GoViet247: 0326 184 628.",
          "Không cần nhắn Support chỉ vì tài xế khác đã nhận trước, chuyến đã bị huỷ, hết mở nhận hoặc còn đếm ngược. Nếu có dấu hiệu bất thường hay lỗi kéo dài thì vẫn nên báo để được kiểm tra."
        ]
      }
    ]
  },
  {
    "id": "contact-within-15-minutes",
    "title": "Nhận chuyến xong: liên hệ ngay, chậm nhất 15 phút",
    "summary": "Chuyến đặt trước vẫn cần xác nhận ngay. Có sự cố phải báo Support ngay.",
    "sections": [
      {
        "title": "Xác nhận sớm để khách yên tâm đã có xe",
        "paragraphs": CONTACT_AFTER_ACCEPT_PARAGRAPHS
      }
    ]
  },
  {
    "id": "accept-success",
    "title": "Tăng khả năng nhận chuyến thành công",
    "summary": "Thao tác nhận chuyến, kết nối mạng và điện thoại.",
    "sections": [
      {
        "title": "Những điểm cần lưu ý",
        "paragraphs": [
          "Thao tác nhanh: Khi có chuyến mới, anh/chị theo dõi thời gian đếm ngược và bấm nhận ngay khi nút nhận chuyến được mở, tránh để chậm vài giây vì các tài xế khác cũng đang chờ nhận.",
          "Kết nối Internet: Ưu tiên sử dụng 4G/5G có sóng mạnh, ổn định. Tránh khu vực sóng yếu hoặc Wi-Fi chập chờn vì có thể khiến thao tác nhận chuyến gửi lên hệ thống chậm hơn.",
          "Điện thoại: Nên sử dụng điện thoại hoạt động mượt, hạn chế mở quá nhiều ứng dụng cùng lúc. Nếu máy bị giật, lag hoặc phản hồi chậm thì khả năng nhận chuyến thành công cũng sẽ giảm.",
          "Ứng dụng GoViet247: Luôn cập nhật phiên bản mới nhất, đảm bảo ứng dụng có kết nối mạng ổn định và hạn chế bật chế độ tiết kiệm pin khi đang chờ chuyến.",
          "Chủ động chờ chuyến: Khi có thông báo chuyến mới, anh em mở sẵn ứng dụng và theo dõi thời gian để thao tác nhanh nhất có thể.",
          "Hệ thống ưu tiên tài xế có yêu cầu nhận chuyến hợp lệ được ghi nhận thành công trước. Vì vậy, chỉ cần chậm hơn tài xế khác một chút là chuyến có thể đã được nhận rồi.",
          "Nếu không nhận được chuyến, xem mục “Không nhận được chuyến: thông báo và cách xử lý” để biết cách xử lý và khi nào cần liên hệ Support. Tài xế khác nhận trước hoặc chuyến đã hết mở nhận là trạng thái bình thường."
        ]
      }
    ]
  },
  {
    "id": "operating-province",
    "title": "Cập nhật tỉnh/thành nhận chuyến",
    "summary": "Cập nhật khu vực khi di chuyển sang miền khác để Admin gửi chuyến phù hợp.",
    "sections": [
      {
        "title": "Cách cập nhật",
        "paragraphs": [
          "“Tỉnh/thành nhận chuyến” là tỉnh/thành nơi anh/chị đang hoạt động và sẵn sàng nhận chuyến. Khu vực này do anh/chị chủ động chọn và lưu trong hồ sơ.",
          "Mở “Hồ sơ tài xế” → chọn “Tỉnh/thành nhận chuyến” → bấm “Cập nhật khu vực nhận chuyến”.",
          "Nếu tỉnh/thành đang hiển thị đã đúng, anh/chị vẫn cần bấm “Cập nhật khu vực nhận chuyến” để xác nhận. Chỉ xem hoặc chọn tỉnh/thành mà chưa bấm lưu thì thông tin chưa được xác nhận.",
          "Khi sang miền khác, anh/chị hãy cập nhật lại tỉnh/thành đang sẵn sàng nhận chuyến và bấm “Cập nhật khu vực nhận chuyến” để Admin gửi chuyến phù hợp."
        ]
      }
    ]
  },
  {
    "id": "zalo-after-accept",
    "title": "Kết bạn Zalo sau khi nhận chuyến",
    "summary": "Kênh phối hợp và hỗ trợ chuyến đi với GoViet247.",
    "sections": [
      {
        "title": "Kết nối với GoViet247",
        "paragraphs": [
          "Quý tài xế vui lòng chủ động kết bạn Zalo với GoViet247 ngay sau khi nhận chuyến thành công để thuận tiện trao đổi, cập nhật thông tin chuyến đi và nhận hỗ trợ kịp thời khi cần thiết.",
          "Zalo GoViet247: 0326 184 628.",
          "Việc kết nối Zalo giúp GoViet247 và tài xế phối hợp nhanh chóng, hạn chế bỏ lỡ các thông tin quan trọng liên quan đến chuyến đi."
        ]
      }
    ]
  },
  {
    "id": "convenient-route",
    "title": "Ưu tiên nhận chuyến thuận đường",
    "summary": "Chọn chuyến gần vị trí hoặc phù hợp với cung đường của mình.",
    "sections": [
      {
        "title": "Lựa chọn chuyến phù hợp",
        "paragraphs": [
          "Quý tài xế vui lòng ưu tiên nhận chuyến gần vị trí hoặc thuận đường. Nếu ở quá xa, đặc biệt với chuyến một chiều, tài xế sẽ tốn thêm chi phí di chuyển và có thể phải chạy xe không chiều về, trong khi tài xế đang ở gần hoặc thuận tuyến lại không kịp nhận chuyến.",
          "Mình cùng nhận chuyến hợp lý để chuyến đi hiệu quả hơn cho tất cả anh em nhé."
        ]
      }
    ]
  },
  {
    "id": "check-before-accept",
    "title": "Đọc kỹ thông tin trước khi nhận chuyến",
    "summary": "Kiểm tra loại xe, nhiên liệu và ghi chú của khách.",
    "sections": [
      {
        "title": "Loại xe và nhiên liệu",
        "paragraphs": [
          "Đọc kỹ toàn bộ thông tin chuyến trước khi bấm “Nhận chuyến”. Kiểm tra khách đặt xe 5 chỗ, 7 chỗ hay 16 chỗ.",
          "Khách đặt 5 chỗ → xe 5 chỗ hoặc 7 chỗ có thể nhận. Khách đặt 7 chỗ → chỉ xe 7 chỗ nhận. Khách đặt 16 chỗ → chỉ xe 16 chỗ nhận.",
          "Nếu khách có yêu cầu xe điện hoặc xe xăng, tài xế chỉ nhận khi xe của mình đáp ứng đúng yêu cầu. Nếu hiển thị “Không yêu cầu” thì xe phù hợp đều có thể nhận."
        ]
      },
      {
        "title": "Ghi chú và trách nhiệm khi nhận",
        "paragraphs": [
          "Vui lòng đọc kỹ phần ghi chú vì khách có thể có thêm yêu cầu riêng cho chuyến đi.",
          "Không nên bấm nhận trước rồi mới đọc thông tin. Nhận sai yêu cầu khiến khách phải chờ, mất thời gian liên hệ và tìm lại tài xế, đồng thời ảnh hưởng đến trải nghiệm khách hàng và uy tín GoViet247.",
          "Trường hợp tài xế nhận sai yêu cầu và phải huỷ chuyến, phí đã trừ khi nhận chuyến sẽ không được hoàn lại.",
          "ĐỌC KỸ → KIỂM TRA LOẠI XE → NHIÊN LIỆU → GHI CHÚ → PHÙ HỢP MỚI NHẬN."
        ]
      }
    ]
  },
  {
    "id": "wallet-guide",
    "title": "Hướng dẫn nhận chuyến và sử dụng ví tài xế",
    "summary": "Nhận chuyến, nạp ví, khấu trừ và thanh toán.",
    "sections": [
      {
        "title": "1. Làm sao để nhận chuyến?",
        "paragraphs": [
          "Sau khi hồ sơ tài xế được duyệt, các chuyến mới sẽ tự động hiển thị tại mục “Chuyến đang chờ” trên ứng dụng khi có khách đặt chuyến phù hợp.",
          "Trước khi bấm “Nhận chuyến”, vui lòng đọc kỹ: điểm đón và điểm trả; ngày giờ đón, giờ về nếu là chuyến khứ hồi; loại xe khách yêu cầu; giá chuyến; ghi chú và yêu cầu của khách; chuyến có phù hợp, thuận tiện với cung đường của mình hay không.",
          "Nếu thấy phù hợp, tài xế bấm “Nhận chuyến”. Sau khi nhận thành công, vào Đơn của tôi để gọi hoặc chat trong app. Xem mục “Nhận chuyến xong: liên hệ ngay, chậm nhất 15 phút” để thực hiện đúng quy trình xác nhận và báo Support khi có sự cố.",
          CONTACT_AFTER_ACCEPT.deadline,
          CONTACT_AFTER_ACCEPT.channels,
          "GoViet247 là ứng dụng kết nối xe tiện chuyến. Số lượng chuyến phụ thuộc vào nhu cầu đặt xe của khách theo từng thời điểm và khu vực; hệ thống không thể cam kết tài xế sẽ nhận được số lượng chuyến cố định."
        ]
      },
      {
        "title": "2. Vì sao cần nạp tiền vào ví?",
        "paragraphs": [
          "Ví tài xế chỉ dùng để hệ thống khấu trừ phí và thuế khi tài xế nhận chuyến. Đây không phải tiền đặt cọc và hiện tại GoViet247 không yêu cầu tài xế ký quỹ.",
          "Tài xế cần có đủ số dư ví trước khi nhận chuyến. Nếu số dư không đủ, ứng dụng sẽ thông báo số tiền còn thiếu."
        ]
      },
      {
        "title": "3. Nạp tiền vào ví như thế nào?",
        "paragraphs": [
          "Tại ứng dụng GoViet247 Driver: Mở Menu → chọn “Ví tài xế” → chọn “Nạp tiền” → quét mã QR hoặc chuyển khoản theo thông tin hiển thị → ghi chính xác nội dung chuyển khoản do ứng dụng cung cấp.",
          "Nội dung thường có dạng: NAPVI + TÊN TÀI XẾ + SỐ ĐIỆN THOẠI.",
          "Sau khi nhận được giao dịch, Admin sẽ kiểm tra và cộng tiền vào ví. Nếu đã chuyển khoản nhưng ví chưa cập nhật, tài xế vui lòng gửi biên lai để GoViet247 hỗ trợ kiểm tra."
        ]
      },
      {
        "title": "4. Ví bị trừ khi nào và trừ bao nhiêu?",
        "paragraphs": [
          "Tiền trong ví được khấu trừ ngay khi tài xế bấm “Nhận chuyến” thành công. Số tiền thực tế cần có trong ví và thu nhập còn lại được hiển thị trên ứng dụng theo cấu hình áp dụng cho chuyến.",
          "Ví dụ minh hoạ trong thông báo: phí hệ thống 5%, VAT tài xế 3%, PIT tài xế 1,5%; tổng cộng 9,5% giá chuyến.",
          "Với ví dụ chuyến 1.000.000đ: phí hệ thống 50.000đ, VAT 30.000đ, PIT 15.000đ; tổng tiền cần có trong ví 95.000đ; thu nhập còn lại 905.000đ.",
          "Các con số trên là ví dụ từ thông báo được lưu lại, không phải mức phí cố định cho mọi chuyến. Vui lòng xem số khấu trừ và thu nhập thực tế trên chuyến trước khi nhận."
        ]
      },
      {
        "title": "5. Khách thanh toán như thế nào?",
        "paragraphs": [
          "Khách hàng thanh toán giá chuyến trực tiếp cho tài xế sau khi hoàn thành chuyến đi.",
          "Giá hiển thị trên ứng dụng là giá trọn gói khách phải thanh toán và đã bao gồm chi phí cầu đường nếu có. Tài xế không được tự ý thu thêm tiền hoặc thương lượng lại giá sau khi đã nhận chuyến.",
          "Nếu khách yêu cầu thay đổi điểm đón, điểm trả hoặc phát sinh hành trình ngoài nội dung ban đầu, tài xế vui lòng liên hệ GoViet247 trước khi thực hiện."
        ]
      },
      {
        "title": "6. Lưu ý khi đã nhận chuyến",
        "paragraphs": [
          "Việc bấm “Nhận chuyến” đồng nghĩa tài xế đã đọc kỹ thông tin và đồng ý với giá chuyến.",
          "Tài xế vui lòng chỉ nhận những chuyến thật sự phù hợp. Trường hợp tài xế tự huỷ sau khi nhận, khoản tiền đã khấu trừ có thể được giữ lại theo quy định huỷ chuyến của hệ thống.",
          "Mọi thắc mắc hoặc cần hỗ trợ, tài xế có thể liên hệ GoViet247 ngay trên ứng dụng."
        ]
      }
    ]
  },
  {
    "id": "all-inclusive",
    "title": "Giá trên app là giá trọn gói",
    "summary": "Không tự thu thêm tiền hoặc thương lượng lại giá sau khi nhận.",
    "sections": [
      {
        "title": "Kiểm tra trước khi nhận",
        "paragraphs": [
          "GoViet247 là nền tảng kết nối các chuyến xe phù hợp với cung đường và kế hoạch di chuyển của tài xế. Trước khi bấm “Nhận chuyến”, vui lòng kiểm tra kỹ: điểm đón và điểm trả; thời gian đón, thời gian về nếu là chuyến khứ hồi; loại xe và chiều di chuyển; ghi chú, yêu cầu của khách; giá chuyến trên ứng dụng; chuyến đi có phù hợp và thuận tiện với hành trình của mình hay không.",
          "Nếu cảm thấy chuyến không phù hợp, Quý Tài xế vui lòng không nhận chuyến."
        ]
      },
      {
        "title": "Lưu ý quan trọng",
        "paragraphs": [
          "Giá hiển thị trên ứng dụng là GIÁ TRỌN GÓI khách hàng phải thanh toán cho chuyến đi, đã bao gồm chi phí cầu đường nếu có. Tài xế tuyệt đối không được tự ý thu thêm tiền, yêu cầu khách hỗ trợ thêm chi phí hoặc thương lượng lại giá sau khi đã nhận chuyến.",
          "Việc bấm “Nhận chuyến” đồng nghĩa với việc tài xế đã xem đầy đủ thông tin, đồng ý với giá chuyến và cam kết thực hiện đúng hành trình đã hiển thị trên ứng dụng.",
          "Nếu khách hàng yêu cầu thay đổi điểm đón, điểm trả, lịch trình hoặc phát sinh yêu cầu ngoài nội dung chuyến ban đầu, tài xế vui lòng liên hệ GoViet247 để được hỗ trợ trước khi thực hiện; không tự thoả thuận khoản thu thêm với khách."
        ]
      }
    ]
  },
  {
    "id": "multi-day",
    "title": "Quy định đối với chuyến đi nhiều ngày",
    "summary": "Chỗ nghỉ, ăn uống và phối hợp phục vụ trong thời gian khách lưu trú.",
    "sections": [
      {
        "title": "Phục vụ chuyến nhiều ngày",
        "paragraphs": [
          "Giá chuyến nhiều ngày đã được GoViet247 xây dựng phù hợp với đặc thù của loại chuyến này.",
          "Tài xế chủ động sắp xếp chỗ nghỉ và chi phí ăn uống của mình trong thời gian thực hiện chuyến đi, trừ khi GoViet247 có thông báo hoặc thoả thuận khác trước chuyến.",
          "Trong thời gian khách lưu trú, tài xế vui lòng hỗ trợ đưa đón khách theo lịch trình đã đặt. Trường hợp khách chỉ di chuyển quanh khu vực lưu trú để ăn uống, cà phê hoặc sinh hoạt gần đó thì chủ động hỗ trợ trong phạm vi hợp lý.",
          "Nếu khách phát sinh nhu cầu đi xa hoặc thay đổi đáng kể lịch trình, vui lòng liên hệ GoViet247 trước khi thực hiện. Không tự thoả thuận hoặc thu thêm chi phí từ khách khi chưa có xác nhận của GoViet247."
        ]
      }
    ]
  },
  {
    "id": "driver-operation",
    "title": "Quy định hoạt động tài xế GoViet247",
    "summary": "Tác phong, xác nhận chuyến, bảo mật và xử lý vi phạm.",
    "sections": [
      {
        "title": "1. Thái độ và tác phong phục vụ khách hàng",
        "paragraphs": [
          "Gọi điện và trao đổi lịch sự với khách hàng. Không sử dụng lời nói thô tục, khó chịu hoặc gây áp lực cho khách.",
          "Chủ động hỗ trợ khách trong phạm vi hợp lý; hỗ trợ sắp xếp hành lý lên/xuống xe cho khách.",
          "Giữ tác phong gọn gàng, lịch sự và hợp tác trong suốt chuyến đi. Không hút thuốc, gây ồn ào hoặc làm khách khó chịu trong quá trình di chuyển.",
          "Chủ động thông báo cho khách nếu có tình huống phát sinh như kẹt xe hoặc đến trễ.",
          "Không tự ý đổi xe hoặc đổi tài xế cho chuyến đi khi chưa được GoViet247 xác nhận hoặc hỗ trợ xử lý. Không tự ý chở thêm người lạ trong chuyến đi.",
          "Vi phạm có thể dẫn đến cảnh cáo, tạm khoá hoặc khoá tài khoản tuỳ mức độ."
        ]
      },
      {
        "title": "2. Quy trình xác nhận đón/trả khách",
        "paragraphs": [
          "Tài xế cần thực hiện đầy đủ các bước xác nhận theo hướng dẫn trong mục “Đơn của tôi”.",
          "Trong một số chuyến đi, hệ thống có thể yêu cầu: chụp hình xác nhận đón/trả khách; gửi định vị tại điểm đón hoặc điểm trả khách; xác nhận trạng thái chuyến đi đúng thực tế.",
          "Các thông tin này giúp bảo vệ quyền lợi cho tài xế và khách hàng, hỗ trợ xử lý khiếu nại hoặc tranh chấp nếu phát sinh, đảm bảo minh bạch trong quá trình vận hành chuyến đi.",
          "Không giả mạo hình ảnh, vị trí hoặc trạng thái chuyến đi. Vi phạm có thể dẫn đến hạn chế nhận chuyến, tạm khoá hoặc khoá tài khoản tuỳ mức độ."
        ]
      },
      {
        "title": "3. Không kéo khách ra ngoài hệ thống",
        "paragraphs": [
          "Để phục vụ chuyến đi, tài xế và khách có thể liên hệ qua ứng dụng GoViet247 hoặc gọi trực tiếp bằng số điện thoại hiển thị trên chuyến. Với chuyến đối tác, số điện thoại điều phối viên được ẩn; tài xế chỉ liên hệ điều phối viên phụ trách qua chat hoặc gọi trong app GoViet247 để bảo mật thông tin khách hàng của đối tác. Chỉ sử dụng thông tin liên hệ cho chuyến đã nhận và không dùng để mời chào hoặc nhận chuyến ngoài hệ thống. Khi cần hỗ trợ, vui lòng liên hệ GoViet247.",
          "Khi có phản ánh vi phạm, GoViet247 sẽ kiểm tra thông tin và tiếp nhận giải trình của tài xế trước khi quyết định xử lý. Tùy tính chất, mức độ và số lần vi phạm, biện pháp xử lý có thể gồm nhắc nhở, tạm hạn chế nhận chuyến hoặc khóa tài khoản đối với trường hợp nghiêm trọng hay tái phạm."
        ]
      },
      {
        "title": "4. Không nhận “cuốc ngoài” từ khách trong app",
        "paragraphs": [
          "Không nhận chuyến riêng ngoài ứng dụng từ khách đã kết nối qua GoViet247.",
          "Mọi chuyến phát sinh từ hệ thống cần được thực hiện trên ứng dụng để đảm bảo quyền lợi cho khách hàng và tài xế.",
          "Hệ thống có thể hạn chế hoặc khoá tài khoản nếu phát hiện vi phạm."
        ]
      },
      {
        "title": "5. Hạn chế huỷ chuyến",
        "paragraphs": [
          "Không huỷ chuyến nhiều lần sau khi đã nhận. Nếu có sự cố bất khả kháng, cần báo sớm cho khách hoặc bộ phận hỗ trợ.",
          "Không cố tình nhận chuyến nhưng không di chuyển tới điểm đón. Tỷ lệ huỷ cao sẽ ảnh hưởng quyền nhận chuyến hoặc bị tạm khoá tài khoản."
        ]
      },
      {
        "title": "6. Không yêu cầu thêm phí ngoài ứng dụng",
        "paragraphs": [
          "Không tự ý thu thêm phí ngoài giá đã báo trên hệ thống nếu không có xác nhận rõ ràng từ khách. Không gây áp lực để khách trả thêm tiền ngoài ứng dụng.",
          "Vi phạm sẽ bị xử lý nghiêm theo chính sách vận hành."
        ]
      },
      {
        "title": "7. Bảo mật thông tin khách hàng",
        "paragraphs": [
          "Không chia sẻ thông tin khách hàng cho bên thứ ba. Không sử dụng số điện thoại khách cho mục đích cá nhân hoặc quảng cáo. Không lưu thông tin khách để tự liên hệ nhận cuốc ngoài hệ thống."
        ]
      },
      {
        "title": "8. Đảm bảo an toàn và đúng hành trình",
        "paragraphs": [
          "Chủ động đến điểm đón đúng giờ. Không tự ý thay đổi hành trình nếu chưa được khách đồng ý.",
          "Không lái xe nguy hiểm, sử dụng điện thoại liên tục hoặc gây mất an toàn trong quá trình di chuyển. Tuân thủ quy định giao thông và đảm bảo an toàn cho khách hàng."
        ]
      },
      {
        "title": "9. Chính sách xử lý vi phạm",
        "paragraphs": [
          "GoViet247 có thể áp dụng các hình thức xử lý: nhắc nhở; hạn chế nhận chuyến; tạm khoá tài khoản; khoá tài khoản vĩnh viễn, tuỳ theo mức độ vi phạm.",
          "GoViet247 ưu tiên môi trường hoạt động lâu dài, chuyên nghiệp và công bằng cho tất cả tài xế."
        ]
      }
    ]
  }
];
