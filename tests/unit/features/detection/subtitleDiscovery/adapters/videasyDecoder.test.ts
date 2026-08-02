// Pure decoder tests for the videasy "sources-with-title" payload.

import { decryptVideasyResponse, base64UrlToBytes } from '@/features/detection/subtitleDiscovery/adapters/videasyDecoder';

describe('videasyDecoder', () => {
  const cipher =
    'RO1SdrvAlm5awujIs7aOysu8Rdao3lcpwItbhrToRnmf2q1HPYo9j1pvVYrG2O03lm35_gHe_RVT9_Ts09zFuERv6XJPgB6UBcRQyHdidWe1zJj7X34zN88soBH01Rc4b3f7umBX3PVkYOpUY0fNl4-tuyecEuAoXmDt80D89ZcbVJGLmk86E0jAyg3djOr-OwPFBavk_659e0hOp2Zo5XPqxeCjGyWtF1Qp5EvJB7v8y0fJUTQZmtri3nxYWYD3HyIcUpBo9qVvTpbX9HMcLyVc_BXT3vqSwp7PQ1CDvbQ-HTopUV45M834fXpvkX4WtII9jnHQGyk5CdWdv_MBVR4LxgDZznoeRdYgxVNS6HevAXp_ddpR0RJujFyFGOsvyndwMLr1tC6puJJTXWv6WVVaXrMm34HBOH5GuWRTF-wsVc35gyEgOM9L0zur1_K-E7LB3yI6gNoOo-E3cJSsDnIA98mrs1Agy3RKzLIsY-ssdCQ5jzk0nlHAOsg46bvgX1PBH46EUiBdcRLOLvAiXlJ6NyfN7YFF9JdHMYAdbn0BmDkq3Nidqz_KCxd3ijrEXS2ZFmZNZUjfbyR0cs7dzkRkw69BdKt47N7JAJtUW8Aq6OI1GeNhtKAP3H44o9OrKUpOnxJx6NjLjXW-IgKSMggJ1Dhv47WqnzXM6Ah8HBb5eZ8kfV5mnDVIOyRQ1oDAOZICRvbme5Xi7MJQg1w2V_15c0cGTv6JHi-W8KJut0P_alnEkFjI0iwc2hemq4heO1cly2X6TVFkiDbmgHVjMKda_aMsLZD6PnyqS7Z1fN7GLoCf-mEMo2R9cBsmkJjsHCTLxZUSeaSPFdykgo5nISLJySgy8_93DNcoBvWKsUTEjei-tWAWp__XzTti6hiiWv1q2SgTMubpsevcRj_Qks4rBZg';

  it('decrypts a real m4uhd payload', () => {
    const listing = decryptVideasyResponse(cipher, '59523314.KnuAYJu6hrSfrh9q8Aa4vT', 125988);

    expect(listing.sources).toHaveLength(1);
    expect(listing.sources[0]!.quality).toBe('playhq');
    expect(listing.sources[0]!.url).toContain('.m3u8');
    expect(listing.subtitles).toHaveLength(1);
    expect(listing.subtitles[0]!.lang).toBe('EN');
    expect(listing.subtitles[0]!.url).toContain('api.playhq.net/sub');
  });

  it('fails with the wrong seed', () => {
    expect(() => decryptVideasyResponse(cipher, 'wrong-seed', 125988)).toThrow(/bad seed/);
  });

  it('fails with the wrong mediaId', () => {
    expect(() => decryptVideasyResponse(cipher, '59523314.KnuAYJu6hrSfrh9q8Aa4vT', 99999)).toThrow(/bad seed/);
  });

  it('base64UrlToBytes decodes base64url to Uint8Array', () => {
    const bytes = base64UrlToBytes('SGVsbG8td29ybGQ_');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(12);
  });
});
