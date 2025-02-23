import zod from "zod";

export const CreateJettonRequest = zod.object({
  name: zod.string(),        // Token'ın adı
  description: zod.string(), // Token'ın açıklaması
  image_data: zod.string(),  // Token'ın görseli (base64)
  symbol: zod.string(),      // Token'ın sembolü (örn: "BTC")
  decimals: zod.number(),    // Token'ın ondalık basamak sayısı
  amount: zod.string(),      // Oluşturulacak token miktarı
});

export type CreateJettonRequestDto = zod.infer<typeof CreateJettonRequest>;
