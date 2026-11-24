// Painel e histórico precisam de todas as páginas, não somente dos primeiros 100 registros.
export async function listAll(list, query = {}, options = {}) {
  const items = [];
  let page = 1;
  let totalPages;

  do {
    const result = await list({ ...query, page, limit: 100 }, options);

    items.push(...result.items);
    totalPages = result.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return items;
}
