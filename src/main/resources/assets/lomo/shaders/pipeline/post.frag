#include frex:shaders/api/header.glsl
#extension GL_ARB_bindless_texture : require
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/reflection.frag */

uniform sampler2D u_reflective;

uniform sampler2D u_main;
uniform sampler2D u_depth;

varying vec2 _cvv_texcoord;

struct reflection_result {
	bool success;
	vec4 color;
	float a;
	float len;
};

reflection_result failed_reflection_result(float len) {
	return reflection_result(false, vec4(0), 0, len);
}

reflection_result reflect(float first_step_len, vec3 pos_cs, vec3 dir_cs, float max_len) {
	if(dir_cs.xy == vec2(0)) dir_cs = vec3(0, 0, -1);
	mat4 proj = frx_projectionMatrix();
	float step = first_step_len;//abs( ( 1 / max( 0.001, abs( cos_between_normal_and_ray ) ) ) ) / 140;

	float ray_len_chage = -pos_cs.z / 50;
	float ray_len = ray_len_chage;
	pos_cs += dir_cs*ray_len;

	int steps = 200;
	while(true) {
		//float prev_len = ray_len;
		ray_len_chage += step;
		ray_len += ray_len_chage;
		pos_cs += dir_cs*ray_len_chage;

		//if(pos_cs.z >= 0) return failed_reflection_result(ray_len);;

		vec3 pos_ws = cam_to_win(pos_cs, proj);
		if(pos_ws.z >= 1 || pos_ws.z <= 0) return failed_reflection_result(ray_len);

		vec2 tex_uv = pos_ws.xy / frxu_size;

		vec2 magic = (tex_uv - 0.5);
		float closeness_to_border = max(abs(magic.y), abs(magic.x)) * 2;
		if(closeness_to_border >= 1) return failed_reflection_result(ray_len);

		float d_ws = texture2D(u_depth, tex_uv).r;

		float diff = pos_ws.z - d_ws;
		if(diff > 0) {
			if(diff > 0.003*ray_len) return failed_reflection_result(ray_len);

			float ratio = clamp(1 - closeness_to_border*closeness_to_border, 0, 1);
			return reflection_result(true, texture2D(u_main, tex_uv), ratio, ray_len);
		}

		if(ray_len >= max_len) { return failed_reflection_result(ray_len); }
		step += ( step / 60 );

		--steps;
		if(steps <= 0) return failed_reflection_result(ray_len);
	}
}

reflection_result reflect(vec3 pos_cs, vec3 dir_cs, float cos_between_normal_and_ray, float max_len) {
	reflection_result res = reflect(
		abs( ( 1 / max( 0.001, abs( cos_between_normal_and_ray ) ) ) ) / 140,
		pos_cs,
		dir_cs,
		max_len
	);

	float sin_between_normal_and_ray = sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);

	res.a*=sin_between_normal_and_ray;

	return res;
}

void main() {
	vec4 packed_normal = texture2D(u_reflective, _cvv_texcoord);

	vec4 reflection_color = vec4(0);
	float ratio = 0;

	vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
	if(normal == vec3(0)) normal = vec3(1, 0, 0);
	mat4 view = frx_viewMatrix();
	mat4 proj = frx_projectionMatrix();

	float depth_ws = texture2D(u_depth, _cvv_texcoord).r ;
	vec3 pos_ws = vec3(gl_FragCoord.xy, depth_ws);
	vec3 pos_cs = win_to_cam(pos_ws, proj);

	mat3 rot = mat3(view);
	vec3 normal_cs = normalize(rot * normal);
	vec3 into_camera = normalize(-pos_cs);
	float cos_between_normal_and_ray = dot(into_camera, normal_cs);
	vec3 ref_cs = reflect(normalize(pos_cs), normal_cs);

	if(packed_normal.a != 0) {

		reflection_result res = reflect(pos_cs, ref_cs, cos_between_normal_and_ray, 10000);

		if(res.success) {
			reflection_color = res.color;
			ratio = res.a;
		}
	}

	vec4 color = mix(texture2D(u_main, _cvv_texcoord), reflection_color, ratio);

	reflection_result res = reflect(0.01, pos_cs, normal_cs, 0.5);

	mat3 mat = mat3(vec3(normal_cs.y, -normal_cs.x, normal_cs.z), normal_cs, normal_cs);
	if(res.success) {
		color = mix(vec4(0), color, clamp(res.len, 0, 0.5)*2);
	}

	gl_FragData[0] = color;
}