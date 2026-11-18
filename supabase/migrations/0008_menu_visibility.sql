-- 0008 菜單可見性:停用的項目只有擁有者看得到(SPEC 第 9 節)。
-- 已成交的訂單使用快照(title_snapshot 等),不受影響;create_order 為 SECURITY DEFINER,也不受影響。
drop policy menu_items_select on public.menu_items;
create policy menu_items_select on public.menu_items for select to authenticated
  using (
    couple_id = public.current_couple_id()
    and (active or owner_id = (select auth.uid()))
  );
