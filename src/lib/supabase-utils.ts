import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

/**
 * Fetch all data from a Supabase table with pagination.
 * Supabase has a default limit of 1000 rows per query.
 * This function fetches data in chunks until all records are retrieved.
 */
export async function fetchAllPaginated(
  tableName: "sh2m_data" | "highticket_data" | "payment_history" | "source_iklan_categories" | "duplicate_branch_assignments",
  options?: {
    orderBy?: { column: string; ascending: boolean }[];
  }
): Promise<any[]> {
  const { orderBy } = options || {};
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query: any = supabase
      .from(tableName)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    // Apply ordering
    if (orderBy) {
      for (const order of orderBy) {
        query = query.order(order.column, { ascending: order.ascending });
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}
