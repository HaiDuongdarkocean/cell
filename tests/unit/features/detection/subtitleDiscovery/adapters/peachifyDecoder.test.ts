// Pure decoder tests for the peachify AES-GCM payload.

import { decryptPeachifyResponse } from '@/features/detection/subtitleDiscovery/adapters/peachifyDecoder';

// Real encrypted response captured from usa.eat-peach.sbs/holly/tv/125988/1/2
const ENCRYPTED_PAYLOAD =
  'GEmQULiD51RxBNm5.ZvGUwGtfgi-049md4LZpad4KCOnvHSFPcsTmcCF25S7oYgpXyQ_NuCba-jaEqDxQ2MoAkurW1i1-pBO3hsLpQcsN1G2wYn9MMSmfjdFV3kLDE4jqTksoZu9bMbSPAXg_IhUV5DmWI21EBvduCnUoIiK6r1LK0VR7em-ngkp5mcEdPlKWBkqTzCNygWAcX1RyngQg-i4ZBM8AvXGhYXkPMBD1ERnxC9WdeLV_toe_WwMZj8LtNOYSIE3YteImiF0y182XkYTEOwxKF_JDhxwqVEeKH4-pLSPumk5AGccF1AEpJoi3f6liZWykO5tpIT3oVNVKVC30H1hY6zhySDeLizVI0p5C0fOs_XM-5xNjoH2GTtyLUl6fXDIAFXLPL2rQKHFB_NADeJGAShazkw7TArrEsfSoA0qfPAlC5vNevpaAsJpm8t-MwgAevVf1ztXcrFPJ8ZdpYtLEDGfKV0EisGVTNZGH9GWAOGHkiLrni86-VtkT65m6JcTIj_wh39SzKvxaCSNFqkosNtXv_MXCD939eM5qkXIq0SdlBA17oCsf0npbHw64tL5qX_FIgSvsn7hfsQoaIx4HQk_2ly7stA1KMJj4WbKZsrkmZ1B78YvRwP0XOJcBFoUAyewFiHORKi5R7GL0xMTOWR-vgJCtu16FNbSgb-u_NThBhpjTImNHTL8r0aT6odR1LbHkINda0-vjqMvb1MVxTB9sV9mIoLOVjZ3tpbQfjjjm61gmGVw-xa0AnhIpHWp6WflmNNlOR9mM17abYyYiUYn6dC1kj0vA6P68EKpC0WZjCjv-EksI1iSV8biLYLZYwrJ7kL7POS7H4sPaeQRXR4fj1V7-Tn4wZwkPpP8JAiFVR1BCaK1UbJJULtodWN86iuob9O_7f4jmYQorhJ-z5mYyADUUEi9mypnmj6yeWwKIjEAHVLnZti5A5dCVmbsnnX0suaFBddnyH9JYC4y8jzQgSkFcf5njS44hThnUsG_-2GXYGra1Q-B7NnfFV37IUMi3Hdmh7zitbBzfySnBJ-AfavwEuYeMv5EpZ4eFYvhmJqQgpUdwYaK6BEDUcGtjvYM6rgDm6gFE4DtkdOuvSlhVicpmv0tggYj3eyqiUk2Y9PtQCTU7GpYmShT46svILyJqpMl4B3rdOXnbvyZ8dq_UbXEA4zzokCk1u8ybt8fiJxtO15TMHu3QXChViilOC70ESea3tMZFUWthhIRsfwPXX2iWOTCpkRxgEiMZWQOB3dTVGf70NsukEjBrIWG2amlYQdPMxGQu1Hq4bzS0wPeI6W4mSpnA9nhKitvUB2YZtd3zkWoUQEA68eVLi1gOYT21Xf0bY53UuyAmWdTJoFB6tqy0E3WuCMmpi8BWvshvSmf1zQiNGewEUMFh05q8IW3YpFNU0ef-AlmpOoQJJK5_VIayesPmmCxEAlVO8-2UYpZ5dmLViO9dfW_53d1bg3LWYh8dyw3TcnkZaf41zWYCEGj5rZIULsLgtaVj1PHwpRhyJgFAiU3bdVZ7D_8mP3kFZQ8dEuCbebxQCYY9HUKafu76meAfcumvMI9hPlkoQPPRHB8LP6aP5QaOJDsKaD2fahaDlaMQc8IC3A_hO6pvaFhlSJ1v9SRIDaSCr4xrBBU00YpVa-CZRswcQHEN_w_EFmSfzDnCzDM6gwroB7TRRw7luBB9MDyzTBA3VIkZnow0w8rQCLWTEOvEKy2a5JVe4wLUA8na5GVJLKdO8hqJB2pT2sF5iPGAzrI9qUjUMrx_hgelWmMyTL5ri1opux2-EGqkKFV0YtbeVGP8MCmP0XoPAzjtzPXgu3iPOdVE50UcwUVZ-IBNwOXSwNeS9V5C5m1Qnj90D3WfMfrC1MOi2a4NHIzimTGO289Y5-QwW92hUBJ0tET9G7q8xBHAbn7jpde-qOWAXRsEXuWHSIyPMHMIzQZkTMjGqsOlNwdyoY3sCyILNK9cL44EsAq6r9NcaH0o8BMN7Ji-awCMr4WeXCDS7S31oT4FOIUUYS4FWX56GF3YYBRUOUavPdJJ_fAjjH1HyPEsuph-jh_GL6TznsBc0rzR9sQovB7tYyZvTBITjhZNVByphj_yQDqRdDoiVbxNXOYKB3LDZ0rirU__Y16jAv7HPUCG66H1538SOpzYThQdIqdIQ6Wl2mGPqSVkxXVtJzxjez6CNjZ_SzB4adnyOca3GyBc6nUYHHby2BlCv1Xmz8h9xFPhAnB_lK2SBVCFcHW9qZ81Fc5jjwTDb3YdnnFKgSD4H4hzSSt-9-rV7abr-y9hTz8cBBOZ17hCSfi8J6sagP4zgfOCG2xVb94cVorqh9q67aJxoxhfvEIrOJjNRwBPcqw7RNkdGzeQCLDIBsuJv3dtV46yK-t1n7-tTka6vo0NniGHVFjWlQDVjTvLWaXFEnCMdwImDSJVRl6CdzMaQTGuOfPkGwLN-OedYM8hTIN63__1ISw1bWa5UgrNNzJv-DegoKKESSxLEQLHZWnMxlsSzKzK1pO92v2qKOnQUiCLbXgdb_UJfJKB_951IafCadHs3RrGshSe3bevaifye9G4j59DByWVAFATpe0c5f3RUQhwvAtK-XDBe2C-KijY7Nz0R7-C6BPSzBqpgJIyGItgaaEYZXnZ-3e2JGI3PrNEvqhzAag.1KL-dqp7SUB3GCw9A1RlTw';

describe('peachifyDecoder', () => {
  it('decrypts a real peachify payload and returns sources + subtitles', async () => {
    const listing = await decryptPeachifyResponse(ENCRYPTED_PAYLOAD);

    // The holly server should return at least one source.
    expect(listing.sources).toBeDefined();
    expect(listing.sources!.length).toBeGreaterThan(0);

    // Subtitles may or may not be present depending on the server.
    if (listing.subtitles) {
      expect(Array.isArray(listing.subtitles)).toBe(true);
      for (const sub of listing.subtitles) {
        expect(sub.url || sub.file || sub.src).toBeTruthy();
      }
    }
  });

  it('throws on invalid payload format', async () => {
    await expect(decryptPeachifyResponse('invalid.payload')).rejects.toThrow(/expected iv\.ciphertext\.authTag/);
  });

  it('throws on wrong key (garbled payload)', async () => {
    // Same structure but garbage data — should fail AES-GCM auth tag check.
    const garbage = 'AAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    await expect(decryptPeachifyResponse(garbage)).rejects.toThrow();
  });
});
