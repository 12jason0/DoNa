-- course_id 1: 저녁(dinner) 세그먼트 내 순서 지정
UPDATE course_places SET order_in_segment = 0 WHERE id = 5 AND segment = 'dinner';
UPDATE course_places SET order_in_segment = 1 WHERE id = 6 AND segment = 'dinner';
