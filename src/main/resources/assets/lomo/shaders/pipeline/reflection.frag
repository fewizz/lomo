#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/reflection.frag */

#define LOMO_REFLECTION_TYPE 0

uniform sampler2D u_reflective;
uniform sampler2D u_input;
uniform sampler2D u_input_depth;

varying vec2 _cvv_texcoord;

void main() {
	vec4 packed_normal = (texture2D(u_reflective, _cvv_texcoord) - 0.5) * 2;

	vec4 reflection_color = vec4(0);
	float ratio = 0;

	if(packed_normal != vec4(-1)) {
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float win_s_depth = texture2D(u_input_depth, _cvv_texcoord).r ;
		vec3 win_s_position = vec3(gl_FragCoord.xy, win_s_depth);
		vec3 cam_s_position = win_to_cam(win_s_position, proj);

		mat3 rotation = mat3(view);
		vec3 cam_s_normal = normalize(rotation * packed_normal.xyz);

		vec3 into_camera = normalize(-cam_s_position);
		float cos_between_normal_and_ray = dot(into_camera, cam_s_normal);
		vec3 reflection_dir = normalize(into_camera + (cam_s_normal*cos_between_normal_and_ray - into_camera)* 2);
		

#if LOMO_REFLECTION_TYPE == 1
		vec3 reflection_win_s_a = cam_to_win(cam_s_position, proj);
		vec3 reflection_win_s_b = cam_to_win(cam_s_position + reflection_dir, proj);

		vec2 win_s_reflection_dir = (reflection_win_s_b-reflection_win_s_a).xy;
		if(win_s_reflection_dir == vec2(0)) win_s_reflection_dir = vec2(0.0001);

		win_s_reflection_dir = normalize(win_s_reflection_dir);
		
		vec2 position = win_s_position.xy;

		float step = 1.5 * abs(1/max(0.01, abs(cos_between_normal_and_ray)));
		float dist = 0;

		float z_to_x;
		if(abs(reflection_dir.x) > 0.0001) z_to_x = reflection_dir.z / reflection_dir.x;
		else z_to_x = 1000;

		vec2 tex_uv = position / frxu_size;

		float z_numerator = (cam_s_position.z - z_to_x*cam_s_position.x);
		float z_denominator = 1 + (z_to_x*(tex_uv.x*2 - 1 + proj[2][0])/proj[0][0]);
		float z_denominator_addition = ((z_to_x*win_s_reflection_dir.x/frxu_size.x)*2)/proj[0][0];

		while(true) {
			dist += step;

			tex_uv += win_s_reflection_dir*step/ frxu_size;
			
			if(abs(reflection_dir.z) <= 0.0001) {
				reflection_color = vec4(1, 0, 0, 1);
				ratio = 1;
				break;
			}

			float denom = (z_denominator + z_denominator_addition*dist );
			if(denom == 0) {
				reflection_color = vec4(0, 1, 0, 1);
				ratio = 1;
				break;
			}
			float z = z_numerator / denom;

			float zw = z_cam_to_win(z, proj);

			vec2 magic = (tex_uv - 0.5);
			float closeness_to_border = max(abs(magic.y), abs(magic.x)) * 2;
			if(closeness_to_border >= 1) break;

			float win_s_depth = texture2D(u_input_depth, tex_uv).r;

			// We hit the ground
			if(win_s_depth < zw) {
				// farness from borderreverting,
				// clamping, so that it will be close to 0 on borders, and 1 in center
				ratio = clamp(1 - closeness_to_border, 0, 1);
				// apply angel, but we need sin
				ratio *= sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);
				reflection_color = texture2D(u_input, tex_uv);
				break;
			}

			if(z < 0);
			else break;
			step += step/30;
		}

#elif LOMO_REFLECTION_TYPE == 0
		float step = abs(cam_s_position.z / 50);
		float ray_len = step;//abs(cam_s_position.z / 50);

#define MAX_STAGE 4
		float stage = -1;

		while(true) {
			ray_len += step;
			vec3 position = cam_s_position + reflection_dir*ray_len;

			if(position.z >= 0) break;

			win_s_position = cam_to_win(position, proj);
			vec2 tex_uv = win_s_position.xy / frxu_size;

			vec2 magic = (tex_uv - 0.5);
			float closeness_to_border = max(abs(magic.y), abs(magic.x)) * 2;
			if(closeness_to_border >= 1) break;

			float win_s_depth = texture2D(u_input_depth, tex_uv).r;

			// We hit the ground
			if(win_s_depth < win_s_position.z || stage >= MAX_STAGE) {
				if(stage == -1) {
					ray_len = ray_len - step;
					step = step / MAX_STAGE;
					stage = 0;
					//continue; Won't work on amd cards...
				}else {
				// farness from borderreverting,
				// clamping, so that it will be close to 0 on borders, and 1 in center
				ratio = clamp(1 - closeness_to_border, 0, 1);

				// apply angel, but we need sin
				ratio *= sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);
				reflection_color = texture2D(u_input, tex_uv);
				break;
				}
			}

			if(stage >= 0) ++stage;
			else step += step/20 * abs(1/max(0.01, abs(cos_between_normal_and_ray)));
		}

#endif

	}

	gl_FragData[0] = texture2D(u_input, _cvv_texcoord) * (1-ratio) + reflection_color*ratio;
}