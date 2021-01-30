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
};

reflection_result reflect(vec3 pos_cs, vec3 dir_cs, float cos_between_normal_and_ray) {
	mat4 proj = frx_projectionMatrix();
	float step = abs( ( 1 / max( 0.001, abs( cos_between_normal_and_ray ) ) ) ) / 140;

	float ray_len = -pos_cs.z / 50 + step;
	pos_cs += dir_cs*ray_len;

	while(true) {
		ray_len += step;
		pos_cs += dir_cs*ray_len;

		if(pos_cs.z >= 0) break;

		vec3 pos_ws = cam_to_win(pos_cs, proj);
		vec2 tex_uv = pos_ws.xy / frxu_size;

		vec2 magic = (tex_uv - 0.5);
		float closeness_to_border = max(abs(magic.y), abs(magic.x)) * 2;
		if(closeness_to_border >= 1) return reflection_result(false, vec4(0), 0);

		float d_ws = texture2D(u_depth, tex_uv).r;

		if(pos_ws.z > d_ws) {
			{
				// farness from borderreverting,
				// clamping, so that it will be close to 0 on borders, and 1 in center
				float ratio = clamp(1 - closeness_to_border*closeness_to_border, 0, 1);
				float sin_between_normal_and_ray = sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);
				ratio*=sin_between_normal_and_ray;

				// apply angle, but we need sin
				//ratio *= clamp(sin_between_normal_and_ray*1.5, 0, 1);
				return reflection_result(true, texture2D(u_main, tex_uv), ratio);
				/*reflection_color =*///return reflect_result(texture2D(main_texs[res.index], tex_uv), ratio);
				//break;
			}
		}
		step += ( step / 60 );
	}
}

void main() {
	vec4 packed_normal = texture2D(u_reflective, _cvv_texcoord);

	vec4 reflection_color = vec4(0);
	float ratio = 0;

	if(packed_normal.a != 0) {
		vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float depth_ws = texture2D(u_depth, _cvv_texcoord).r ;
		vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
		vec3 position_cs = win_to_cam(position_ws, proj);

		mat3 rotation = mat3(view);
		vec3 normal_cs = normalize(rotation * normal);

		vec3 into_camera = normalize(-position_cs);
		float cos_between_normal_and_ray = dot(into_camera, normal_cs);
		vec3 reflection_dir = normal_cs*cos_between_normal_and_ray*2 - into_camera;

		reflection_result res = reflect(position_cs, reflection_dir, cos_between_normal_and_ray);

		if(res.success) {
			reflection_color = res.color;
			ratio = res.a;
		}
	}

	gl_FragData[0] = mix(texture2D(u_main, _cvv_texcoord), reflection_color, ratio);
}