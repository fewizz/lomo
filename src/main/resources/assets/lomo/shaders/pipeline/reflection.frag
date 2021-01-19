#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/reflection.frag */

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

		float window_s_depth = texture2D(u_input_depth, _cvv_texcoord).r ;
		vec3 window_s_position = vec3(gl_FragCoord.xy, window_s_depth);
		vec3 world_s_position = window_to_world(window_s_position, proj);

		mat3 rotation = mat3(view);
		vec3 world_s_normal = normalize(rotation * packed_normal.xyz);

		vec3 into_camera = normalize(-world_s_position);
		float cos_between_normal_and_ray = dot(into_camera, world_s_normal);
		vec3 reflection_dir = normalize(into_camera + (world_s_normal*cos_between_normal_and_ray - into_camera)* 2);
		
		float ray_len = -world_s_position.z / 50;
		float step = 0.01;

		vec3 position = world_s_position + reflection_dir*ray_len;

		while(true) {
			window_s_position = world_to_window(position, proj);
			vec2 tex_uv = window_s_position.xy / frxu_size;

			vec2 magic = (tex_uv - 0.5);
			float closeness_to_border = max(abs(magic.y), abs(magic.x)) * 2;
			if(closeness_to_border >= 1) break;

			float window_s_depth = texture2D(u_input_depth, tex_uv).r;

			if(window_s_depth <= 0 || window_s_depth >= 1) break;

			float world_s_depth = z_window_to_world(window_s_depth, proj);

			// We hit the ground
			if(window_s_depth < window_s_position.z) {
				// farness from borderreverting,
				// clamping, so that it will be close to 0 on borders, and 1 in center
				ratio = clamp(1 - closeness_to_border, 0, 1);

				// apply angel, but we need sin
				ratio *= sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);
				reflection_color = texture2D(u_input, tex_uv);
				break;
			}

			ray_len += step;

			position += reflection_dir*step;
			step += step / 40;
		}
	}

	gl_FragData[0] = texture2D(u_input, _cvv_texcoord) * (1-ratio) + reflection_color*ratio;
}