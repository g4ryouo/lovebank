begin;
select plan(1);
select ok(true, 'pgTAP 可執行');
select * from finish();
rollback;
