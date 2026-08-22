// hardsubCues — burned-in subtitle cues for the mock-youtube-hardsub page.
// Inlined from "[English] How Have You Been.srt" + "[Vietnamese] How Have You Been.srt"
// (data/resource/media/...) so the mock page has zero runtime fetch dependency.
// Times in seconds. Both languages share the same timing so split mode OCR
// (top=target=English, bottom=native=Vietnamese) can detect both streams.

export interface HardsubCue {
  readonly start: number;
  readonly end: number;
  readonly en: string;
  readonly vi: string;
}

export const HARDSUB_CUES: readonly HardsubCue[] = [
  { start: 26.68, end: 32.88, en: 'Are you still getting up late in the morning', vi: 'Có phải, vẫn quen đến muộn' },
  { start: 33.52, end: 38.16, en: "Staying up for work and can't get a good night's sleep", vi: 'Thức khuya làm việc, lại ngủ không ngon' },
  { start: 38.8, end: 44.84, en: "After you've reached your goal", vi: 'Chờ anh, hoàn thành mục tiêu của mình' },
  { start: 45.12, end: 50.24, en: 'Promise me never overwork yourself again', vi: 'Phải thay đổi sở thích miễn cưỡng bản thân' },
  { start: 50.68, end: 56.8, en: 'My ego got in the way', vi: 'Đều trách em, đã đặt lòng tự tôn lên quá cao' },
  { start: 57.24, end: 62.36, en: 'I wish I had given you the shelter that you crave', vi: 'Không chăm sóc anh được tốt' },
  { start: 62.68, end: 68.68, en: 'Underneath my pride is a fragile soul', vi: 'Kiêu ngạo, là bề ngoài của sự mềm yếu' },
  { start: 68.68, end: 73.32, en: 'My world tumbles down if you say no', vi: 'Trái tim sợ em nhất, anh không cần' },
  { start: 73.52, end: 79.72, en: "Don't stop giving me all your emotions", vi: 'Có thể tiếp tục chăng, khóc với em, cười với em, tốt với em' },
  { start: 79.76, end: 86.24, en: 'I will be by your side always and forever', vi: 'Tiếp tục để em, nghĩ cho anh, cuồng nhiệt vì anh, bên anh đến già' },
  { start: 86.28, end: 91.64, en: 'How have you been, I really want to know', vi: 'Anh có khỏe không, muốn biết lắm' },
  { start: 92.16, end: 97.64, en: "Don't rush to throw away our memories", vi: 'Đừng vội vứt bỏ những những ký ức' },
  { start: 97.92, end: 104.16, en: 'I only want you to be at my side and keep me company', vi: 'Em chỉ cần anh, ở bên, cãi cọ cùng em, chí chóe cùng em' },
  { start: 104.2, end: 110.48, en: "I'll be a different and better version of me", vi: 'Lấy cái tốt của em thay đổi cái xấu của em trước đây' },
  { start: 110.72, end: 117.36, en: 'If I could only hear you say you love me', vi: 'Muốn nghe lắm, anh kiên quyết nói yêu em' },
  { start: 117.68, end: 122.16, en: "Too bad we can't go back to that moment", vi: 'Tiếc thay không thể trở về giây phút ấy' },
  { start: 122.6, end: 126.92, en: 'How have you been?', vi: 'Anh có khỏe không' },
  { start: 135.4, end: 141.36, en: "Heaven knows I can't take it anymore", vi: 'Không biết, em sắp không thể chịu đựng nổi nữa rồi' },
  { start: 142.0, end: 146.84, en: 'Regret burns inside of me', vi: 'Hối hận xuyên vào tim thiêu đốt' },
  { start: 147.32, end: 153.28, en: 'All I need is one more of your warm embrace', vi: 'Vòng tay, chỉ thêm một lần nữa thôi' },
  { start: 153.6, end: 157.96, en: 'I can be the man you want me to be', vi: 'Em đều sẽ làm được những điều anh muốn' },
  { start: 158.24, end: 164.36, en: "Don't stop giving me all your emotions", vi: 'Có thể tiếp tục chăng, khóc với em, cười với em, tốt với em' },
  { start: 164.6, end: 170.72, en: 'I will be by your side always and forever', vi: 'Tiếp tục để em, nghĩ cho anh, cuồng nhiệt vì anh, bên anh đến già' },
  { start: 171.04, end: 176.0, en: 'Will you still take me back', vi: 'Cho anh những điều tốt đẹp, có cần không' },
  { start: 176.6, end: 181.8, en: 'I ask and dare not know the answer', vi: 'Đáp án em lại không dám biết' },
  { start: 182.24, end: 188.68, en: 'I only want you to be at my side and keep me company', vi: 'Em chỉ cần anh, ở bên, cãi cọ cùng em, chí chóe cùng em' },
  { start: 188.9, end: 195.4, en: 'Don\u2019t turn your back on me\u2026 I know how much you mean to me', vi: 'Đừng dạy em người mất đi là người quan trọng nhất bằng cách rời xa em' },
  { start: 195.4, end: 201.4, en: "Don't say that you used to love me", vi: 'Đừng nói, anh đã từng yêu em' },
  { start: 201.76, end: 206.18, en: "Let's go back to that moment", vi: 'Hãy để chúng ta trở về giây phút ấy' },
  { start: 206.72, end: 210.04, en: 'How have you been?', vi: 'Anh có khỏe không' },
  { start: 218.24, end: 224.44, en: "Don't stop giving me all your emotions", vi: 'Có thể tiếp tục chăng, khóc với em, cười với em, tốt với em' },
  { start: 224.56, end: 230.88, en: 'I will be by your side always and forever', vi: 'Tiếp tục để em, nghĩ cho anh, cuồng nhiệt vì anh, bên anh đến già' },
  { start: 231.28, end: 236.2, en: 'How have you been, I really want to know', vi: 'Anh có khỏe không, muốn biết lắm' },
  { start: 236.92, end: 242.04, en: "Don't rush to throw away my love", vi: 'Đừng vội vứt bỏ tình yêu của em' },
  { start: 242.4, end: 248.8, en: 'I only want you to be at my side and keep me company', vi: 'Em chỉ cần anh, ở bên, cãi cọ cùng em, chí chóe cùng em' },
  { start: 249.2, end: 255.16, en: 'Don\u2019t turn your back on me\u2026 I know how much you mean to me', vi: 'Đừng dạy em người mất đi là người quan trọng nhất bằng cách rời xa em' },
  { start: 255.64, end: 261.48, en: "Don't say that you used to love me", vi: 'Đừng nói, anh đã từng yêu em' },
  { start: 261.88, end: 266.2, en: "Let's go back to that moment", vi: 'Hãy để chúng ta trở về giây phút ấy' },
  { start: 266.92, end: 271.64, en: 'How have you been?', vi: 'Anh có khỏe không' },
];

/** Find the active cue at a given time (seconds). */
export function findHardsubCue(time: number): HardsubCue | undefined {
  return HARDSUB_CUES.find((c) => time >= c.start && time < c.end);
}
